-- 014_blocca_funzioni_rpc.sql
--
-- SECURITY migration: only the backend may call the room/request functions.
--
-- These functions are SECURITY DEFINER (they run with the owner's rights and
-- skip RLS) and trust the p_owner_id / p_studente_id / p_utente they receive.
-- If anon or authenticated could call them through PostgREST
-- (POST /rest/v1/rpc/...), anyone could pass another user's id and, for
-- example, free any owner's room or accept/decline/cancel any request.
--
-- Supabase grants EXECUTE on new public functions to PUBLIC, anon and
-- authenticated by default, so this lock is lost whenever a function is
-- dropped and created again. Keeping it here makes a DB rebuilt from the
-- migrations safe too. (posizione_in_lista was already locked in 007; it is
-- repeated so every backend-only function is in one place.)
--
-- Nothing in the app breaks: the backend calls these functions with the
-- service-role key (supabaseAdmin), which keeps EXECUTE.
--
-- Safe to run more than once. To undo (NOT recommended):
--   GRANT EXECUTE ON FUNCTION <function>(<args>) TO anon, authenticated;

-- Backend-only functions, with their exact signatures.
REVOKE EXECUTE ON FUNCTION
  public.libera_stanza(bigint, uuid),
  public.accetta_richiesta(bigint, uuid),
  public.rifiuta_richiesta(bigint, uuid),
  public.annulla_richiesta(bigint, uuid),
  public.posizione_in_lista(uuid, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.libera_stanza(bigint, uuid),
  public.accetta_richiesta(bigint, uuid),
  public.rifiuta_richiesta(bigint, uuid),
  public.annulla_richiesta(bigint, uuid),
  public.posizione_in_lista(uuid, integer)
TO service_role;
