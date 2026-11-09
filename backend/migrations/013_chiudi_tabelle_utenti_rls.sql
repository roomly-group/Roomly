-- 013_chiudi_tabelle_utenti_rls.sql
--
-- SECURITY migration (audit finding U-1): close utenti, preferenze_utenti,
-- stanze_foto and messages to direct access through the public REST API.
--
-- The browser holds a real user JWT and the public anon key. Anything those
-- two roles (anon, authenticated) are allowed to do on a table, a user can do
-- with one HTTP call, skipping the backend. On utenti that would include
-- PATCHing their own row to admin = true.
--
-- State before this migration (checked on the live DB, 2026-11-09):
--   - RLS was already ON on all four tables, with no policies, so normal
--     SELECT / INSERT / UPDATE / DELETE from anon/authenticated already
--     returned nothing.
--   - anon and authenticated still held ALL table privileges, including
--     TRUNCATE, which RLS does NOT cover. One accidental policy (or RLS being
--     turned off) would have reopened the tables completely.
--
-- This migration removes those privileges so RLS is no longer the only lock.
-- Same model as 008, 010 and 011: RLS on, no policies, REVOKE ALL.
--
-- Nothing in the app breaks: the frontend never queries these tables (it uses
-- Supabase only for auth.*), and the backend uses the service-role key, which
-- keeps its own grants and ignores RLS.
--
-- Reversible: GRANT the privileges back to anon, authenticated (see bottom).

-- RLS on (already on live; kept so a fresh DB built from migrations is safe too).
ALTER TABLE public.utenti            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferenze_utenti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stanze_foto       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;

-- Remove every table privilege from the two roles the public API runs as.
REVOKE ALL ON public.utenti,
              public.preferenze_utenti,
              public.stanze_foto,
              public.messages
  FROM anon, authenticated;

-- To undo:
--   GRANT ALL ON public.utenti, public.preferenze_utenti,
--                public.stanze_foto, public.messages TO anon, authenticated;
