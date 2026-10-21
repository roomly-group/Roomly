-- 005_stanze_luoghi_vicini.sql
--
-- SCHEMA migration: stores the places near each room (nearest bus/metro stop,
-- supermarket, pharmacy, cafe, gym, library) computed from OpenStreetMap when the
-- room is created or its address changes. The listing page reads them from here
-- instead of querying OpenStreetMap from every visitor's browser.
--
--   luoghi_vicini             jsonb   [{ category, name, latitude, longitude, meters }]
--   luoghi_vicini_aggiornati  timestamptz  when they were last computed
--
-- Safe to run more than once. Run it once in the Supabase SQL editor before
-- deploying the backend that writes these columns (the backend tolerates the
-- columns being missing, it just shows no nearby places until then).

ALTER TABLE public.stanze
  ADD COLUMN IF NOT EXISTS luoghi_vicini jsonb,
  ADD COLUMN IF NOT EXISTS luoghi_vicini_aggiornati timestamptz;
