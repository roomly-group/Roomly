-- Fix: the previous migration (202609040001) added `posizione` with
-- DEFAULT 0, which silently set posizione = 0 for every user who already
-- existed in `utenti` at that time. Because the trigger computes the next
-- position as MAX(posizione) + 1, every new signup since then has been
-- getting posizione = 1 (since MAX() over a table full of zeros is 0).
--
-- This backfills real, sequential positions for the historical rows based
-- on signup order (created_at), so MAX(posizione) reflects reality again.

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
    FROM public.utenti
    WHERE posizione = 0
)
UPDATE public.utenti u
SET posizione = ranked.rn
FROM ranked
WHERE u.id = ranked.id;

-- Note: if some legitimately-first user is expected to have posizione = 1
-- already (e.g. an already-corrected row), this WHERE posizione = 0 filter
-- will leave it untouched, since it only touches rows still stuck at the
-- default. Re-run is safe: once fixed, no row will match posizione = 0
-- anymore (unless a genuinely new row is inserted with the default before
-- the trigger fires, which the trigger always corrects immediately after).
