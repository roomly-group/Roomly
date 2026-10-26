-- 008_chiudi_stanze_rls.sql
--
-- SECURITY migration: stop signed-in users reading rooms straight from the
-- database with their own session token.
--
-- The "view active rooms" policy let ANY signed-in user (every waitlist
-- signup) query `stanze` through the public REST API and read the exact
-- address (indirizzo, cap) and precise coordinates of every active room,
-- plus the owner id. The backend API deliberately rounds coordinates and
-- never returns the address (exact address stays hidden until the booking
-- fee is paid, CLAUDE.md principle 3), but the direct path bypassed that.
--
-- The frontend never queries these tables directly: every read and write
-- goes through the backend with the service-role key, which ignores RLS.
-- So dropping these policies changes nothing for the app. RLS stays ON, and
-- with no policies left the tables are closed to anon and authenticated.
--
-- Reversible: the policy definitions are kept below, commented out.

DROP POLICY IF EXISTS "view active rooms" ON public.stanze;
DROP POLICY IF EXISTS "owners select own rooms" ON public.stanze;
DROP POLICY IF EXISTS "owners insert rooms" ON public.stanze;
DROP POLICY IF EXISTS "owners update own rooms" ON public.stanze;
DROP POLICY IF EXISTS "owners delete own rooms" ON public.stanze;
DROP POLICY IF EXISTS "view photos of visible rooms" ON public.stanze_foto;
DROP POLICY IF EXISTS "owners manage own photos" ON public.stanze_foto;

-- Previous definitions (to restore, re-create with CREATE POLICY):
--   stanze "view active rooms"            SELECT authenticated USING (attiva = true AND stato = 'disponibile')
--   stanze "owners select own rooms"      SELECT authenticated USING (proprietario_id = auth.uid())
--   stanze "owners insert rooms"          INSERT authenticated WITH CHECK (proprietario_id = auth.uid() AND EXISTS (SELECT 1 FROM utenti u WHERE u.id = auth.uid() AND u.owner = true))
--   stanze "owners update own rooms"      UPDATE authenticated USING (proprietario_id = auth.uid()) WITH CHECK (proprietario_id = auth.uid())
--   stanze "owners delete own rooms"      DELETE authenticated USING (proprietario_id = auth.uid())
--   stanze_foto "view photos of visible rooms" SELECT authenticated USING (EXISTS (SELECT 1 FROM stanze s WHERE s.id = stanze_foto.stanza_id AND ((s.attiva AND s.stato = 'disponibile') OR s.proprietario_id = auth.uid())))
--   stanze_foto "owners manage own photos"     ALL authenticated USING/WITH CHECK (EXISTS (SELECT 1 FROM stanze s WHERE s.id = stanze_foto.stanza_id AND s.proprietario_id = auth.uid()))
