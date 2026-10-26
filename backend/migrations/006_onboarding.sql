-- 006_onboarding.sql
--
-- SCHEMA migration: the answers collected by the onboarding that follows
-- signup (/onboarding), plus a private bucket for profile photos.
--
--   fonte_scoperta            varchar  "Come ci hai scoperto?" (instagram, tiktok, ...)
--   fonte_scoperta_altro      varchar  free text when the answer is "altro"
--   arrivo_previsto           date     first day of the month the student needs the room
--   durata_permanenza         varchar  semestre / un_anno / piu_anni / non_so
--   onboarding_completato_at  timestamptz  set when the required steps are done
--
-- Name, date of birth, photo (foto_profilo), university, course and bio already
-- have columns on `utenti`; the budget and lifestyle answers go to
-- `preferenze_utenti`.
--
-- Additive only, safe to run more than once. Run it in the Supabase SQL editor
-- BEFORE deploying the backend that reads these columns.

ALTER TABLE public.utenti
  ADD COLUMN IF NOT EXISTS fonte_scoperta varchar(20),
  ADD COLUMN IF NOT EXISTS fonte_scoperta_altro varchar(100),
  ADD COLUMN IF NOT EXISTS arrivo_previsto date,
  ADD COLUMN IF NOT EXISTS durata_permanenza varchar(20),
  ADD COLUMN IF NOT EXISTS onboarding_completato_at timestamptz;

ALTER TABLE public.utenti DROP CONSTRAINT IF EXISTS utenti_fonte_scoperta_check;
ALTER TABLE public.utenti ADD CONSTRAINT utenti_fonte_scoperta_check
  CHECK (fonte_scoperta IS NULL OR fonte_scoperta IN
    ('instagram', 'tiktok', 'linkedin', 'amico', 'google', 'ai', 'facebook', 'altro'));

ALTER TABLE public.utenti DROP CONSTRAINT IF EXISTS utenti_durata_permanenza_check;
ALTER TABLE public.utenti ADD CONSTRAINT utenti_durata_permanenza_check
  CHECK (durata_permanenza IS NULL OR durata_permanenza IN ('semestre', 'un_anno', 'piu_anni', 'non_so'));

-- Profile photos: private, read through short-lived signed URLs made by the
-- backend (same approach as foto_stanze). Files live at <user id>/<uuid>.jpg.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('foto_profilo', 'foto_profilo', false, 5242880, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;
