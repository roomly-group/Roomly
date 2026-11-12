-- 018_sincronizza_email_utenti.sql
--
-- SECURITY migration (audit finding RMY-06): keeps utenti.email equal to the
-- login email in auth.users.
--
-- The email change itself goes through the backend (PATCH /api/me/email in
-- routes/me.ts), which asks for the current password (or an emailed code for
-- Google-only accounts). When Supabase finally writes the new address into
-- auth.users (after the confirmation link(s) are opened), this trigger copies
-- it into public.utenti in the same transaction.
--
-- This trigger and function were already live in Supabase, created by hand
-- from the dashboard, but no migration recorded them. This file records them
-- unchanged so the repo matches the database, and adds the same REVOKE as
-- 014/017.
--
-- REVOKE is safe for the trigger: Postgres checks EXECUTE only when the
-- trigger is created, not each time it fires.
--
-- Safe to run more than once. To undo:
--   DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
--   DROP FUNCTION IF EXISTS public.sync_email_utenti();

-- ===================== FUNCTION =====================

-- Copies the new login email into the public profile row of the same user.
CREATE OR REPLACE FUNCTION public.sync_email_utenti()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  update public.utenti
  set email = new.email,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

-- Backend/DB only (see 014): never callable through the public API.
REVOKE EXECUTE ON FUNCTION public.sync_email_utenti() FROM PUBLIC, anon, authenticated;

-- ===================== TRIGGER =====================

-- Fires only when the email really changes, not on every auth.users update
-- (sign-ins update last_sign_in_at on every login).
DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (OLD.email::text IS DISTINCT FROM NEW.email::text)
EXECUTE FUNCTION public.sync_email_utenti();
