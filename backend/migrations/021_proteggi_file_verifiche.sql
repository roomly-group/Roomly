-- 021_proteggi_file_verifiche.sql
--
-- PRIVACY migration (audit finding RMY-03): an identity verification row can
-- never be deleted while its ID document photos or challenge video are still
-- in storage. Files first, row after: never the other way round.
--
-- Why: verifiche_identita.utente_id is ON DELETE CASCADE. If a user row is
-- removed by hand (e.g. from the Supabase dashboard) instead of through the
-- app's account deletion (lib/account.ts, which removes the files first), the
-- rows that point at the files vanish and the files stay in the bucket with
-- nothing pointing at them: biometric data kept forever by accident.
--
-- With this trigger such a deletion fails as a whole (the cascade rolls back)
-- with SQLSTATE RM008. Use the app's account deletion instead, or remove the
-- files through the Storage API first.
--
-- The app's own paths are unaffected, because they already remove the files
-- through the Storage API before deleting any row:
--   - DELETE /api/me            (lib/account.ts -> public.elimina_account)
--   - POST /api/me/verification (routes/verification.ts drops the old draft)
-- The backend also sweeps the bucket every 6 hours for folders of users that
-- no longer exist (lib/verification.ts, purgeOrphanedVerificationFiles).
--
-- How it checks: it looks in storage.objects for any file of the attempt,
-- both under its folder (<user id>/<attempt id>/...) and at the exact paths
-- saved in the row. Checked on the live DB (2026-11-14): the function owner
-- (postgres) can read storage.objects and bypasses its RLS; bucket
-- verifiche_identita has versioning DISABLED, so a removed file's row is gone.
-- If versioning is ever enabled, archived copies count as files still stored
-- and deletions are refused until they are purged too (fails closed).
--
-- Same access model as 014: the function is SECURITY DEFINER and nobody may
-- call it through the public API.
--
-- Safe to run more than once. To undo:
--   DROP TRIGGER IF EXISTS proteggi_file_verifica ON public.verifiche_identita;
--   DROP FUNCTION IF EXISTS public.proteggi_file_verifica();

-- ===================== FUNCTION =====================

CREATE OR REPLACE FUNCTION public.proteggi_file_verifica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  -- Bucket of the document photos and videos (= VERIFICATION_BUCKET in the backend).
  BUCKET constant text := 'verifiche_identita';
  -- Folder of this attempt. A uuid and a number: no LIKE wildcard can appear in it.
  v_cartella text := old.utente_id::text || '/' || old.id::text || '/';
begin
  if exists (
    select 1
      from storage.objects o
     where o.bucket_id = BUCKET
       and (
         o.name like v_cartella || '%'
         or o.name in (old.documento_fronte, old.documento_retro, old.video)
       )
  ) then
    raise exception 'Identity verification % still has files in storage: delete them first', old.id
      using errcode = 'RM008',
            hint = 'Delete the account from the app, or remove the files through the Storage API first.';
  end if;

  return old; -- BEFORE trigger: let the delete go ahead
end;
$$;

-- Backend/DB only (see 014): never callable through the public API.
REVOKE EXECUTE ON FUNCTION public.proteggi_file_verifica() FROM PUBLIC, anon, authenticated;

-- ===================== TRIGGER =====================

DROP TRIGGER IF EXISTS proteggi_file_verifica ON public.verifiche_identita;
CREATE TRIGGER proteggi_file_verifica
  BEFORE DELETE ON public.verifiche_identita
  FOR EACH ROW
  EXECUTE FUNCTION public.proteggi_file_verifica();
