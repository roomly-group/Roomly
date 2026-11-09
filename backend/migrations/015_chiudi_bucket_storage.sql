-- 015_chiudi_bucket_storage.sql
--
-- SECURITY migration (audit finding U-3): lock the three private storage
-- buckets so only the backend can read or write their files.
--
--   foto_stanze         room photos
--   foto_profilo        profile photos
--   verifiche_identita  identity documents and challenge videos
--
-- The app never touches these buckets from the browser. The backend uploads,
-- deletes and creates short-lived signed URLs with the service-role key
-- (supabaseAdmin), which ignores RLS and storage policies. So the safe state is:
--   - every bucket public = false (no permanent public URLs);
--   - no policy on storage.objects for these buckets, so anon and
--     authenticated get nothing through the Storage API.
--
-- State before this migration (checked on the live DB, 2026-11-09):
--   - all three buckets already public = false;
--   - no policies at all in the storage schema; RLS on for storage.objects.
-- foto_stanze was created by hand and had no migration; it is added here so a
-- DB rebuilt from the migrations ends up the same.
--
-- Nothing in the app breaks. Safe to run more than once.

-- Bucket settings, kept in one place.
-- foto_stanze: 10 MB, no MIME filter (same as live).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('foto_stanze', 'foto_stanze', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Force private, even if someone flipped the switch in the dashboard.
UPDATE storage.buckets
   SET public = false
 WHERE id IN ('foto_stanze', 'foto_profilo', 'verifiche_identita')
   AND public IS DISTINCT FROM false;

-- Drop any policy on storage.objects that mentions one of these buckets.
-- service_role does not need policies, so every such policy could only open
-- access to anon / authenticated / public. No-op when none exist.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename  = 'objects'
       AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
           ~ '(foto_stanze|foto_profilo|verifiche_identita)'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END
$$;
