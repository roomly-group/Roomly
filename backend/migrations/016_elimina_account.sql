-- 016_elimina_account.sql
--
-- SCHEMA + FUNCTION migration (audit finding RMY-02): users can delete their
-- own account from /profile (DELETE /api/me).
--
-- What happens to the data of a deleted user:
--   - Contracts: deletion is REFUSED while the user has any contract that is
--     not cancelled (the owner must keep it for tax records). Cancelled
--     contracts are deleted.
--   - Listings they own: deleted, with their photos and every chat about them.
--   - Requests they sent as a student: the chat STAYS for the owner. Pending
--     and accepted requests become "annullata" (an accepted one frees the room
--     again), the user's messages lose their text (tipo = 'eliminato') and
--     their sender, and the owner sees "Deleted user".
--   - Preferences, identity checks, profile row: deleted.
--   Files in storage and the auth.users row are removed by the backend
--   (routes/me.ts), which collects the file paths BEFORE calling this function.
--
-- Schema changes (all backwards compatible with the code already live: the
-- running backend always writes a sender and a student, so nothing it does
-- changes):
--   messaggi.mittente_id      nullable, ON DELETE SET NULL (+ index)
--   messaggi.tipo             also accepts 'eliminato'
--   conversazioni.studente_id nullable, ON DELETE SET NULL
--   conversazioni_utenti      ON DELETE CASCADE on utente_id
--
-- Same access model as 014: elimina_account is SECURITY DEFINER and only the
-- backend (service_role) may call it.
--
-- Safe to run more than once. To undo the schema part (only possible while no
-- row has a NULL sender/student and no message has tipo 'eliminato'):
--   ALTER TABLE public.messaggi ALTER COLUMN mittente_id SET NOT NULL;
--   ALTER TABLE public.conversazioni ALTER COLUMN studente_id SET NOT NULL;
--   then recreate the three foreign keys without ON DELETE and the old
--   messaggi_tipo_check (tipo IN ('testo', 'sistema')).

-- ===================== SCHEMA =====================

-- Messages: a deleted user's messages stay in the other person's chat, without a sender.
ALTER TABLE public.messaggi ALTER COLUMN mittente_id DROP NOT NULL;
ALTER TABLE public.messaggi DROP CONSTRAINT IF EXISTS messaggi_mittente_id_fkey;
ALTER TABLE public.messaggi
  ADD CONSTRAINT messaggi_mittente_id_fkey
  FOREIGN KEY (mittente_id) REFERENCES public.utenti(id) ON DELETE SET NULL;

-- Without this index every delete/update by sender scans the whole table.
CREATE INDEX IF NOT EXISTS messaggi_mittente_idx ON public.messaggi (mittente_id);

-- 'eliminato': a message whose author deleted their account (text wiped).
ALTER TABLE public.messaggi DROP CONSTRAINT IF EXISTS messaggi_tipo_check;
ALTER TABLE public.messaggi
  ADD CONSTRAINT messaggi_tipo_check CHECK (tipo IN ('testo', 'sistema', 'eliminato'));

-- Requests: the owner keeps the chat of a student who deleted their account.
-- (The unique index on (stanza_id, studente_id) allows many NULL students.)
ALTER TABLE public.conversazioni ALTER COLUMN studente_id DROP NOT NULL;
ALTER TABLE public.conversazioni DROP CONSTRAINT IF EXISTS conversazioni_studente_id_fkey;
ALTER TABLE public.conversazioni
  ADD CONSTRAINT conversazioni_studente_id_fkey
  FOREIGN KEY (studente_id) REFERENCES public.utenti(id) ON DELETE SET NULL;

-- Chat membership of a deleted user disappears with them.
ALTER TABLE public.conversazioni_utenti DROP CONSTRAINT IF EXISTS conversazioni_utenti_utente_id_fkey;
ALTER TABLE public.conversazioni_utenti
  ADD CONSTRAINT conversazioni_utenti_utente_id_fkey
  FOREIGN KEY (utente_id) REFERENCES public.utenti(id) ON DELETE CASCADE;

-- ===================== FUNCTION =====================

-- Deletes every database row of one user in a single transaction: either all
-- of it happens or nothing does. Raises RM007 while a non-cancelled contract
-- exists. Calling it for a user that no longer exists does nothing, so the
-- backend can safely retry a deletion that failed half-way (e.g. at the
-- auth.users step).
CREATE OR REPLACE FUNCTION public.elimina_account(p_utente uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_now    timestamptz := now();
  v_stanze bigint[];
begin
  -- Lock the user row: serialises with accetta_richiesta (which locks the
  -- student row) and with a second deletion of the same account.
  perform 1 from utenti where id = p_utente for update;
  if not found then return; end if;

  -- 1. Contracts. Signed, registered, ended or draft contracts block the deletion.
  if exists (
    select 1 from contratti
     where (studente_id = p_utente or proprietario_id = p_utente)
       and stato <> 'annullato'
  ) then
    raise exception 'has_contracts' using errcode = 'RM007';
  end if;
  delete from contratti where studente_id = p_utente or proprietario_id = p_utente;

  -- 2. Listings owned by the user, with their photos and all their chats.
  select coalesce(array_agg(id), '{}') into v_stanze from stanze where proprietario_id = p_utente;
  delete from messaggi
   where conversazione_id in (select id from conversazioni where stanza_id = any (v_stanze));
  delete from conversazioni_utenti
   where conversazione_id in (select id from conversazioni where stanza_id = any (v_stanze));
  delete from conversazioni where stanza_id = any (v_stanze);
  delete from stanze_foto where stanza_id = any (v_stanze);
  delete from stanze where id = any (v_stanze);

  -- 3. Requests sent as a student: an accepted one frees its room again
  --    (same as libera_stanza), then pending and accepted ones are cancelled.
  update stanze s
     set stato = 'disponibile'
    from conversazioni c
   where c.studente_id = p_utente
     and c.stato_richiesta = 'accettata'
     and s.id = c.stanza_id
     and s.stato = 'affittata';

  -- 4. The user's own texts lose their content and author. Done before the
  --    notice below so the notice (which has no author) is never wiped.
  update messaggi
     set testo = '-', tipo = 'eliminato', mittente_id = null, letto = true
   where mittente_id = p_utente and tipo = 'testo';
  update messaggi set mittente_id = null where mittente_id = p_utente;

  with chiuse as (
    update conversazioni
       set stato_richiesta = 'annullata', deciso_at = v_now, updated_at = v_now
     where studente_id = p_utente and stato_richiesta in ('in_attesa', 'accettata')
    returning id
  )
  insert into messaggi (conversazione_id, mittente_id, testo, tipo, letto)
  select id, null, 'Lo studente ha eliminato il suo account: richiesta annullata', 'sistema', true
    from chiuse;

  -- 5. Chats that stay: no more link to the user.
  delete from conversazioni_utenti where utente_id = p_utente;
  update conversazioni set studente_id = null where studente_id = p_utente;

  -- 6. Everything else that belongs to the user, then the user row.
  delete from preferenze_utenti where utente_id = p_utente;
  delete from verifiche_identita where utente_id = p_utente;
  delete from messages where sender_id = p_utente; -- legacy table, no foreign key
  delete from utenti where id = p_utente;
end;
$$;

-- Backend only (see 014): nobody may delete an account through the public API.
REVOKE EXECUTE ON FUNCTION public.elimina_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.elimina_account(uuid) TO service_role;
