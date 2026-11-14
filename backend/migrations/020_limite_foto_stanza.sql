-- 020_limite_foto_stanza.sql
--
-- SECURITY migration (audit finding RMY-09): a listing can never have more
-- than 10 photos, even when several uploads arrive at the same moment.
--
-- The backend (routes/roomly.ts, POST /owner/listings/:id/photos) counts the
-- photos and then inserts. Two parallel uploads could both count 9 and both
-- insert, ending at 11. This trigger repeats the check inside the database,
-- after locking the listing row, so inserts for the SAME listing are checked
-- one at a time and the count is always correct. Uploads to different
-- listings do not wait for each other.
--
-- On a refused insert it raises check_violation (SQLSTATE 23514). The backend
-- turns that into the friendly "at most 10 photos" answer and deletes the file
-- it had already put in storage.
--
-- Keep MAX_FOTO in sync with ROOM_PHOTO_MAX_COUNT
-- (backend/local-libs/api-zod/src/constants.ts).
--
-- Same access model as 014: the function is SECURITY DEFINER and nobody may
-- call it through the public API.
--
-- Safe to run more than once. To undo:
--   DROP TRIGGER IF EXISTS limita_foto_stanza ON public.stanze_foto;
--   DROP FUNCTION IF EXISTS public.limita_foto_stanza();

-- ===================== FUNCTION =====================

CREATE OR REPLACE FUNCTION public.limita_foto_stanza()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  -- Most photos one listing may hold (= ROOM_PHOTO_MAX_COUNT in the backend).
  MAX_FOTO constant integer := 10;
begin
  -- Lock the listing: a second insert for the same stanza_id waits here until
  -- the first transaction ends, then sees its row in the count below.
  perform 1 from public.stanze where id = new.stanza_id for update;

  if (select count(*) from public.stanze_foto where stanza_id = new.stanza_id) >= MAX_FOTO then
    raise exception 'A listing can have at most % photos', MAX_FOTO
      using errcode = 'check_violation';
  end if;

  return new; -- BEFORE trigger: let the insert go ahead
end;
$$;

-- Backend/DB only (see 014): never callable through the public API.
REVOKE EXECUTE ON FUNCTION public.limita_foto_stanza() FROM PUBLIC, anon, authenticated;

-- ===================== TRIGGER =====================

DROP TRIGGER IF EXISTS limita_foto_stanza ON public.stanze_foto;
CREATE TRIGGER limita_foto_stanza
  BEFORE INSERT ON public.stanze_foto
  FOR EACH ROW
  EXECUTE FUNCTION public.limita_foto_stanza();
