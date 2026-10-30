-- 010_contratti.sql
--
-- SCHEMA migration: owner contracts ("Contratti", phase 1).
--
-- One row per rental contract between an owner and a student for a room.
-- A contract is always created from an ACCEPTED request (conversazioni), so
-- room and student come from there. Phase 1 has no e-signature or
-- registration partner: the owner moves the contract through its steps by
-- hand and writes down the registration details.
--
--   stato  bozza            draft, not sent yet
--          in_attesa_firma  sent to the student, waiting for the signature
--          firmato          signed, still to be registered with the
--                           Agenzia delle Entrate (deadline computed by the backend)
--          registrato       signed and registered
--          concluso         ended (keys returned / ended early)
--          annullato        cancelled before signing
--
-- Same access model as 008: RLS on with no policies. Only the backend
-- (service role) reads and writes this table.
--
-- Additive only, safe to run more than once. Run it BEFORE deploying the
-- backend that reads this table.

CREATE TABLE IF NOT EXISTS public.contratti (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stanza_id bigint NOT NULL REFERENCES public.stanze(id) ON DELETE RESTRICT,
  proprietario_id uuid NOT NULL REFERENCES public.utenti(id) ON DELETE RESTRICT,
  studente_id uuid NOT NULL REFERENCES public.utenti(id) ON DELETE RESTRICT,
  conversazione_id bigint REFERENCES public.conversazioni(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'transitorio_studenti'
    CHECK (tipo IN ('transitorio_studenti')),
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  canone_mensile numeric(10, 2) NOT NULL CHECK (canone_mensile >= 0),
  deposito numeric(10, 2) CHECK (deposito IS NULL OR deposito >= 0),
  stato text NOT NULL DEFAULT 'bozza'
    CHECK (stato IN ('bozza', 'in_attesa_firma', 'firmato', 'registrato', 'concluso', 'annullato')),
  firma_richiesta_at timestamptz,
  firmato_il date,
  registrato_il date,
  estremi_registrazione varchar(120),
  concluso_il date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contratti_periodo_check CHECK (data_fine > data_inizio)
);

CREATE INDEX IF NOT EXISTS contratti_proprietario_id_idx ON public.contratti (proprietario_id);
CREATE INDEX IF NOT EXISTS contratti_studente_id_idx ON public.contratti (studente_id);
CREATE INDEX IF NOT EXISTS contratti_stanza_id_idx ON public.contratti (stanza_id);

-- At most one live (not cancelled) contract per accepted request.
CREATE UNIQUE INDEX IF NOT EXISTS contratti_conversazione_attiva_key
  ON public.contratti (conversazione_id)
  WHERE stato <> 'annullato' AND conversazione_id IS NOT NULL;

ALTER TABLE public.contratti ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contratti FROM anon, authenticated;
