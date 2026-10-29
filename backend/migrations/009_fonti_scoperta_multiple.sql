-- 009_fonti_scoperta_multiple.sql
--
-- SCHEMA migration: "Come ci hai scoperto?" accepts more than one answer.
--
--   fonti_scoperta  text[]  every channel the user ticked (instagram, tiktok, ...)
--
-- fonte_scoperta (one value, from 006) stays and keeps holding the first
-- answer, so code that reads it (the backend on main, the "required steps"
-- check) keeps working. Existing single answers are copied into the new
-- column, so nobody loses theirs.
--
-- Additive only, safe to run more than once. Run it in the Supabase SQL editor
-- BEFORE deploying the backend that reads fonti_scoperta.
--
-- Where users found us, for deciding where to advertise:
--   SELECT fonte, count(*) AS utenti
--   FROM public.utenti, unnest(fonti_scoperta) AS fonte
--   GROUP BY fonte ORDER BY utenti DESC;

ALTER TABLE public.utenti
  ADD COLUMN IF NOT EXISTS fonti_scoperta text[];

ALTER TABLE public.utenti DROP CONSTRAINT IF EXISTS utenti_fonti_scoperta_check;
ALTER TABLE public.utenti ADD CONSTRAINT utenti_fonti_scoperta_check
  CHECK (fonti_scoperta IS NULL OR fonti_scoperta <@
    ARRAY['instagram', 'tiktok', 'linkedin', 'amico', 'google', 'ai', 'facebook', 'altro']::text[]);

UPDATE public.utenti
SET fonti_scoperta = ARRAY[fonte_scoperta]::text[]
WHERE fonte_scoperta IS NOT NULL AND fonti_scoperta IS NULL;
