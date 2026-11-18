-- 022_consenso_termini_data_nascita.sql
--
-- PRIVACY migration (audit finding RMY-15): proof of consent at signup, and
-- no more unchecked dates of birth.
--
-- 1. New columns on public.utenti:
--    - termini_accettati_at: when the user ticked "I accept the Terms of
--      Service and the Privacy Policy" on the signup page;
--    - termini_versione: which version of those texts they accepted
--      (SIGNUP_CONSENT_VERSION in backend/local-libs/api-zod/src/constants.ts).
--    Both stay NULL for accounts created before this change, and for Google
--    accounts created from the login page (which shows no consent box).
--
-- 2. handle_email_confirmed (fires on auth.users, creates the utenti row when
--    the email is confirmed):
--    - NO LONGER copies data_nascita from the signup metadata. Anyone can put
--      any value there by calling Supabase's signup endpoint directly (e.g. a
--      12-year-old's date), and nothing checked it. The date of birth is now
--      set only by the onboarding (PATCH /api/me/onboarding), which requires
--      the user to be 18+. Our own signup page never sends it.
--    - copies the two consent fields, which POST /api/register writes into
--      the metadata with server-made values. Malformed values are ignored and
--      a time in the future is capped to now(); the confirmation is never
--      blocked by them.
--    Everything else is unchanged from the live function (checked 2026-11-18).
--
-- RUN THIS BEFORE deploying the backend that comes with it: the backend
-- writes the new columns when it creates a utenti row.
--
-- Safe to run more than once. To undo: re-create the previous function
-- (copy it from the database before running this), then
--   ALTER TABLE public.utenti DROP COLUMN termini_accettati_at, DROP COLUMN termini_versione;

-- ===================== COLUMNS =====================

ALTER TABLE public.utenti
  ADD COLUMN IF NOT EXISTS termini_accettati_at timestamptz,
  ADD COLUMN IF NOT EXISTS termini_versione text;

-- Same 32-character limit the backend applies (lib/utenti.ts, CONSENT_VERSION_MAX_LENGTH).
ALTER TABLE public.utenti DROP CONSTRAINT IF EXISTS utenti_termini_versione_check;
ALTER TABLE public.utenti
  ADD CONSTRAINT utenti_termini_versione_check
  CHECK (termini_versione IS NULL OR char_length(termini_versione) BETWEEN 1 AND 32);

-- ===================== FUNCTION =====================

CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_termini_accettati_at timestamptz;
    v_termini_versione text;
BEGIN
    IF NEW.email_confirmed_at IS NOT NULL
       AND (TG_OP = 'INSERT' OR OLD.email_confirmed_at IS NULL) THEN

        -- Signup consent (RMY-15). Never block the confirmation if malformed.
        BEGIN
            v_termini_accettati_at := LEAST(NULLIF(NEW.raw_user_meta_data->>'termini_accettati_at', '')::timestamptz, now());
        EXCEPTION WHEN others THEN
            v_termini_accettati_at := NULL;
        END;
        v_termini_versione := NULLIF(NEW.raw_user_meta_data->>'termini_versione', '');
        IF v_termini_accettati_at IS NULL
           OR v_termini_versione IS NULL
           OR char_length(v_termini_versione) > 32 THEN
            v_termini_accettati_at := NULL;
            v_termini_versione := NULL;
        END IF;

        -- data_nascita is left NULL on purpose (RMY-15): only the onboarding sets it, after the 18+ check.
        INSERT INTO public.utenti (id, email, nome, cognome, email_verificata, created_at, termini_accettati_at, termini_versione)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'nome', ''),
            COALESCE(NEW.raw_user_meta_data->>'cognome', ''),
            true,
            NOW(),
            v_termini_accettati_at,
            v_termini_versione
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

-- Backend/DB only (see 014): never callable through the public API.
REVOKE EXECUTE ON FUNCTION public.handle_email_confirmed() FROM PUBLIC, anon, authenticated;
