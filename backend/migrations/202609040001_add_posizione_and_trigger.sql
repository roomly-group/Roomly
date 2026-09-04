-- Add posizione column to utenti table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'utenti' AND column_name = 'posizione'
    ) THEN
        ALTER TABLE public.utenti
        ADD COLUMN posizione BIGINT NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Function to insert utenti row when email is confirmed
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.email_confirmed_at IS NOT NULL
       AND (TG_OP = 'INSERT' OR OLD.email_confirmed_at IS NULL) THEN
        INSERT INTO public.utenti (id, email, nome, cognome, email_verificata, created_at, posizione)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'nome', ''),
            COALESCE(NEW.raw_user_meta_data->>'cognome', ''),
            true,
            NOW(),
            (SELECT COALESCE(MAX(posizione), 0) + 1 FROM public.utenti)
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_email_confirmed();