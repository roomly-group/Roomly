-- Chat: vincoli, indici e RLS sulle tabelle già esistenti
-- (conversazioni, conversazioni_utenti, messaggi). Non crea colonne nuove.
-- Esegui una volta nel SQL Editor di Supabase. È idempotente.

-- Lunghezza messaggio (NOT VALID: non controlla le righe già presenti).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messaggi_testo_len'
  ) then
    alter table public.messaggi
      add constraint messaggi_testo_len
      check (char_length(testo) between 1 and 2000) not valid;
  end if;
end $$;

create index if not exists messaggi_conversazione_idx
  on public.messaggi (conversazione_id, id);
-- Per il contatore "non letti".
create index if not exists messaggi_non_letti_idx
  on public.messaggi (conversazione_id) where letto = false;
create index if not exists conversazioni_utenti_utente_idx
  on public.conversazioni_utenti (utente_id);
create index if not exists conversazioni_stanza_idx
  on public.conversazioni (stanza_id);

-- Il backend usa la secret key (bypassa RLS) e verifica da sé chi è
-- partecipante. Con RLS attiva e nessuna policy il browser, con la chiave
-- pubblica, non può leggere né scrivere queste tabelle direttamente.
-- (Se hai già policy tue, restano valide.)
alter table public.conversazioni        enable row level security;
alter table public.conversazioni_utenti enable row level security;
alter table public.messaggi             enable row level security;

-- Nota: la tabella public.messages (uuid) non è usata dall'app.
