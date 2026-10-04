-- Chat: unicità, integrità e controllo RLS.
-- Esegui UNA VOLTA nel SQL Editor di Supabase, PRIMA di mettere online il
-- backend aggiornato (il nuovo codice scrive la colonna studente_id).
-- È idempotente: puoi rilanciarla senza danni.

begin;

-- 1) Colonna studente_id su conversazioni -------------------------------
-- Serve per poter dire "una sola chat per (stanza, studente)" con un vincolo
-- del database, invece di sperare che il backend non abbia race condition.
alter table public.conversazioni
  add column if not exists studente_id uuid;

-- Backfill: lo studente è il partecipante che NON è il proprietario della stanza.
update public.conversazioni c
set studente_id = cu.utente_id
from public.conversazioni_utenti cu, public.stanze s
where cu.conversazione_id = c.id
  and s.id = c.stanza_id
  and cu.utente_id <> s.proprietario_id
  and c.studente_id is null;

-- 2) Unisci i duplicati già esistenti (altrimenti l'indice unico fallisce) --
-- Per ogni (stanza, studente) tieni la chat con id più basso, sposta lì i
-- messaggi e cancella le altre.
do $$
begin
  create temp table _chat_dups on commit drop as
  select id,
         min(id) over (partition by stanza_id, studente_id) as keep_id
  from public.conversazioni
  where studente_id is not null;

  delete from _chat_dups where id = keep_id;

  update public.messaggi m
  set conversazione_id = d.keep_id
  from _chat_dups d
  where m.conversazione_id = d.id;

  delete from public.conversazioni_utenti cu
  using _chat_dups d
  where cu.conversazione_id = d.id;

  delete from public.conversazioni c
  using _chat_dups d
  where c.id = d.id;

  -- Riallinea l'orario della chat tenuta all'ultimo messaggio.
  update public.conversazioni c
  set updated_at = greatest(c.updated_at, m.last_at)
  from (
    select conversazione_id, max(created_at) as last_at
    from public.messaggi group by conversazione_id
  ) m
  where m.conversazione_id = c.id;
end $$;

-- 3) Vincoli di unicità ----------------------------------------------------
create unique index if not exists conversazioni_stanza_studente_uniq
  on public.conversazioni (stanza_id, studente_id);

-- Un utente non può essere partecipante due volte della stessa chat.
delete from public.conversazioni_utenti a
using public.conversazioni_utenti b
where a.conversazione_id = b.conversazione_id
  and a.utente_id = b.utente_id
  and a.ctid > b.ctid;

create unique index if not exists conversazioni_utenti_uniq
  on public.conversazioni_utenti (conversazione_id, utente_id);

-- 4) Paginazione: indice già coperto da messaggi_conversazione_idx
--    (conversazione_id, id) della migration 003. Nessuna azione.

-- 5) Difesa in profondità sulla RLS ------------------------------------------
-- RLS attiva senza policy = il browser non può leggere/scrivere. In più
-- togliamo i privilegi di tabella ai ruoli pubblici: se qualcuno in futuro
-- disattiva la RLS per sbaglio, i dati restano comunque chiusi.
-- Il backend usa la service key e non è toccato da questi revoke.
alter table public.conversazioni        enable row level security;
alter table public.conversazioni_utenti enable row level security;
alter table public.messaggi             enable row level security;

revoke all on public.conversazioni        from anon, authenticated;
revoke all on public.conversazioni_utenti from anon, authenticated;
revoke all on public.messaggi             from anon, authenticated;

-- La tabella public.messages (uuid) non è usata dall'app. Se esiste, chiudila
-- allo stesso modo (o eliminala se non ti serve).
do $$
begin
  if to_regclass('public.messages') is not null then
    execute 'alter table public.messages enable row level security';
    execute 'revoke all on public.messages from anon, authenticated';
  end if;
end $$;

commit;

-- ============================================================================
-- CONTROLLI (lanciali a mano dopo la migration, sono solo letture)
-- ============================================================================

-- A) Tabelle di public SENZA RLS: devono essere zero righe (o solo tabelle
--    che vuoi davvero pubbliche).
-- select tablename from pg_tables
-- where schemaname = 'public' and rowsecurity = false;

-- B) Policy esistenti sulle tabelle chat: se compaiono policy "using (true)"
--    o simili, sono un buco.
-- select tablename, policyname, cmd, roles, qual
-- from pg_policies
-- where tablename in ('conversazioni','conversazioni_utenti','messaggi','messages');

-- C) Duplicati rimasti: deve restituire zero righe.
-- select stanza_id, studente_id, count(*) from public.conversazioni
-- where studente_id is not null group by 1,2 having count(*) > 1;

-- D) Chat senza studente_id (backfill non riuscito): idealmente zero.
-- select id, stanza_id from public.conversazioni where studente_id is null;
