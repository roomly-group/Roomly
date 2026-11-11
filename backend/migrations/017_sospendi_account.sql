-- 017_sospendi_account.sql
--
-- SECURITY migration (audit finding RMY-04): a suspended or deleted account
-- (utenti.stato = 'sospeso' or 'eliminato') is also banned in Supabase Auth.
--
-- How to suspend someone today: change utenti.stato in the Supabase dashboard.
-- This trigger then, in the same transaction:
--   - stato becomes anything but 'attivo': sets auth.users.banned_until far in
--     the future (Supabase refuses login, token refresh and Google login with
--     "user_banned") and deletes the user's sessions (their refresh tokens go
--     with them through ON DELETE CASCADE), so access tokens already handed
--     out stop working at once ("session_not_found").
--   - stato goes back to 'attivo': clears banned_until, so they can log in again.
-- The backend also checks utenti.stato in requireAuth (middleware/auth.ts), as
-- a backstop.
--
-- banned_until is a real date (now + 100 years), not 'infinity': the Supabase
-- Auth server reads it as a Go time value, which cannot hold 'infinity'.
-- It is the same value Supabase's own ban_duration = '876000h' sets.
--
-- Account deletion (016) DELETEs the row instead, so it does not fire this
-- trigger; the backend removes the auth user itself.
--
-- Same access model as 014: the function is SECURITY DEFINER and nobody may
-- call it through the public API.
--
-- Safe to run more than once. To undo:
--   DROP TRIGGER IF EXISTS sincronizza_sospensione_account ON public.utenti;
--   DROP FUNCTION IF EXISTS public.sincronizza_sospensione_account();
--   (users banned so far stay banned until banned_until is cleared by hand)

-- ===================== FUNCTION =====================

CREATE OR REPLACE FUNCTION public.sincronizza_sospensione_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
begin
  if new.stato = 'attivo' then
    -- Reactivated: lift the ban.
    update auth.users set banned_until = null where id = new.id;
  else
    -- Suspended or deleted: ban, then end every open session.
    update auth.users set banned_until = now() + interval '100 years' where id = new.id;
    delete from auth.sessions where user_id = new.id;
  end if;
  return null; -- AFTER trigger: the return value is ignored
end;
$$;

-- Backend/DB only (see 014): never callable through the public API.
REVOKE EXECUTE ON FUNCTION public.sincronizza_sospensione_account() FROM PUBLIC, anon, authenticated;

-- ===================== TRIGGER =====================

-- Fires only when stato really changes, not on every profile update.
DROP TRIGGER IF EXISTS sincronizza_sospensione_account ON public.utenti;
CREATE TRIGGER sincronizza_sospensione_account
AFTER UPDATE OF stato ON public.utenti
FOR EACH ROW
WHEN (OLD.stato IS DISTINCT FROM NEW.stato)
EXECUTE FUNCTION public.sincronizza_sospensione_account();

-- ===================== EXISTING ROWS =====================

-- Accounts already suspended before this migration get the same ban.
-- (When written, every account was 'attivo', so this changes nothing.)
UPDATE auth.users u
   SET banned_until = now() + interval '100 years'
  FROM public.utenti p
 WHERE p.id = u.id
   AND p.stato <> 'attivo'
   AND (u.banned_until IS NULL OR u.banned_until < now());

DELETE FROM auth.sessions s
 USING public.utenti p
 WHERE p.id = s.user_id
   AND p.stato <> 'attivo';
