-- 007_inviti.sql
--
-- SCHEMA migration: invite links on the waitlist ("sali in lista").
--
--   codice_invito  varchar(12)  personal code in the invite link (/register?invito=CODE)
--   invitato_da    uuid         who invited this user (set once, right after signup)
--
-- posizione_in_lista(utente, bonus) is the position shown to users: every
-- invited friend who finished the onboarding moves the inviter up `bonus`
-- places. It is a rank, so it has no gaps even when accounts are deleted.
-- Only the backend (service role) may call it.
--
-- Additive only, safe to run more than once. Run it BEFORE deploying the
-- backend that reads these columns.

ALTER TABLE public.utenti
  ADD COLUMN IF NOT EXISTS codice_invito varchar(12),
  ADD COLUMN IF NOT EXISTS invitato_da uuid REFERENCES public.utenti(id) ON DELETE SET NULL;

ALTER TABLE public.utenti
  ALTER COLUMN codice_invito SET DEFAULT substr(md5(gen_random_uuid()::text), 1, 8);

UPDATE public.utenti SET codice_invito = substr(md5(gen_random_uuid()::text), 1, 8) WHERE codice_invito IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS utenti_codice_invito_key ON public.utenti (codice_invito);
CREATE INDEX IF NOT EXISTS utenti_invitato_da_idx ON public.utenti (invitato_da);

CREATE OR REPLACE FUNCTION public.posizione_in_lista(p_utente uuid, p_bonus integer)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH inviti AS (
    SELECT invitato_da AS id, count(*) AS n
    FROM utenti
    WHERE invitato_da IS NOT NULL AND onboarding_completato_at IS NOT NULL
    GROUP BY invitato_da
  ),
  classifica AS (
    SELECT u.id,
           rank() OVER (ORDER BY u.posizione - p_bonus * coalesce(i.n, 0), u.posizione) AS posto
    FROM utenti u
    LEFT JOIN inviti i ON i.id = u.id
  )
  SELECT posto FROM classifica WHERE id = p_utente;
$$;

REVOKE EXECUTE ON FUNCTION public.posizione_in_lista(uuid, integer) FROM PUBLIC, anon, authenticated;
