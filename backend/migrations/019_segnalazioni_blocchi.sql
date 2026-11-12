-- 019_segnalazioni_blocchi.sql
--
-- SAFETY migration (audit finding RMY-12): reports and blocks.
--
--   segnalazioni    A user reports another user (from a chat), one message, or
--                   a listing. Only admins act on a report (routes/safety.ts):
--                   they can suspend the reported user (utenti.stato, see 017),
--                   hide the listing (stanze.attiva = false) and close the
--                   report. A report never changes anything by itself.
--   blocchi_utenti  A user blocks another user: no messages and no new
--                   requests between the two any more, in either direction.
--                   It only affects the blocker's own chats.
--
-- Account deletion (016, elimina_account) keeps working unchanged:
--   - blocks of a deleted user go with them (ON DELETE CASCADE);
--   - reports stay for the team, with the deleted person, listing, chat or
--     message set to NULL (ON DELETE SET NULL). The reported message text is
--     copied into the report (testo_messaggio), so it survives as evidence.
--   For that reason there is no CHECK tying `tipo` to a non-NULL target: a
--   SET NULL would break it. The backend validates targets when inserting.
--
-- Same access model as 008, 010, 011 and 013: RLS on, no policies, REVOKE ALL
-- from the public API roles. Only the backend (service role) reads or writes.
--
-- Safe to run more than once. To undo:
--   DROP TABLE IF EXISTS public.blocchi_utenti;
--   DROP TABLE IF EXISTS public.segnalazioni;

-- ===================== REPORTS =====================

CREATE TABLE IF NOT EXISTS public.segnalazioni (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Who reported. NULL once they deleted their account.
  segnalante_id uuid REFERENCES public.utenti(id) ON DELETE SET NULL,
  -- What is reported: a user (from a chat), one message, or a listing.
  tipo text NOT NULL CHECK (tipo IN ('utente', 'messaggio', 'annuncio')),
  -- Codes shared with the app (REPORT_REASONS in api-zod/src/safety.ts).
  motivo text NOT NULL CHECK (motivo IN ('scam', 'fake_listing', 'harassment', 'spam', 'inappropriate', 'other')),
  -- Optional words of the reporter.
  descrizione text CHECK (descrizione IS NULL OR char_length(descrizione) <= 1000),
  -- The person the report is about (chat partner, message author or listing owner).
  utente_segnalato_id uuid REFERENCES public.utenti(id) ON DELETE SET NULL,
  stanza_id bigint REFERENCES public.stanze(id) ON DELETE SET NULL,
  -- The chat the report came from: admins may read it to judge the report.
  conversazione_id bigint REFERENCES public.conversazioni(id) ON DELETE SET NULL,
  messaggio_id bigint REFERENCES public.messaggi(id) ON DELETE SET NULL,
  -- Copy of the reported message at the time of the report.
  testo_messaggio text CHECK (testo_messaggio IS NULL OR char_length(testo_messaggio) <= 2000),
  -- aperta = waiting for an admin; risolta = action taken; archiviata = nothing to do.
  stato text NOT NULL DEFAULT 'aperta' CHECK (stato IN ('aperta', 'risolta', 'archiviata')),
  nota_admin text CHECK (nota_admin IS NULL OR char_length(nota_admin) <= 1000),
  gestita_da uuid REFERENCES public.utenti(id) ON DELETE SET NULL,
  gestita_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Admin queue: open reports, oldest first.
CREATE INDEX IF NOT EXISTS segnalazioni_stato_idx ON public.segnalazioni (stato, created_at);
-- "How many times was this person reported" and ON DELETE SET NULL lookups.
CREATE INDEX IF NOT EXISTS segnalazioni_utente_segnalato_idx ON public.segnalazioni (utente_segnalato_id);
CREATE INDEX IF NOT EXISTS segnalazioni_segnalante_idx ON public.segnalazioni (segnalante_id);
CREATE INDEX IF NOT EXISTS segnalazioni_stanza_idx ON public.segnalazioni (stanza_id);
CREATE INDEX IF NOT EXISTS segnalazioni_conversazione_idx ON public.segnalazioni (conversazione_id);
CREATE INDEX IF NOT EXISTS segnalazioni_messaggio_idx ON public.segnalazioni (messaggio_id);
CREATE INDEX IF NOT EXISTS segnalazioni_gestita_da_idx ON public.segnalazioni (gestita_da);

-- One OPEN report per reporter and target: pressing "Report" twice does not
-- fill the queue. Once an admin closes it, the same person can report again.
CREATE UNIQUE INDEX IF NOT EXISTS segnalazioni_aperta_unica_idx
  ON public.segnalazioni (
    segnalante_id,
    tipo,
    COALESCE(messaggio_id, 0),
    COALESCE(stanza_id, 0),
    COALESCE(conversazione_id, 0)
  )
  WHERE stato = 'aperta';

ALTER TABLE public.segnalazioni ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.segnalazioni FROM anon, authenticated;

-- ===================== BLOCKS =====================

CREATE TABLE IF NOT EXISTS public.blocchi_utenti (
  bloccante_id uuid NOT NULL REFERENCES public.utenti(id) ON DELETE CASCADE,
  bloccato_id uuid NOT NULL REFERENCES public.utenti(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bloccante_id, bloccato_id),
  CHECK (bloccante_id <> bloccato_id)
);

-- "Who blocked me" lookups (the primary key covers "whom did I block").
CREATE INDEX IF NOT EXISTS blocchi_utenti_bloccato_idx ON public.blocchi_utenti (bloccato_id);

ALTER TABLE public.blocchi_utenti ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocchi_utenti FROM anon, authenticated;
