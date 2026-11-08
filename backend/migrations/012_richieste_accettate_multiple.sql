-- 012_richieste_accettate_multiple.sql
--
-- SCHEMA migration: a student may have more than one accepted request.
--
-- Until now a unique index allowed one `accettata` conversation per student,
-- and the backend refused new requests from a student with an accepted one.
-- The rule is now: the only limit is a running rental contract (contratti
-- firmato/registrato not yet ended), checked by the backend
-- (lib/active-contract.ts). One accepted request per ROOM stays
-- (conversazioni_stanza_accettata_uniq): a room is still rented to one student.
--
-- Safe to run more than once. Run it BEFORE deploying the backend that
-- accepts a second request for the same student. To undo, recreate the index
-- (only possible while no student has two accepted requests):
--   CREATE UNIQUE INDEX conversazioni_studente_accettata_uniq
--     ON public.conversazioni (studente_id) WHERE stato_richiesta = 'accettata';

DROP INDEX IF EXISTS public.conversazioni_studente_accettata_uniq;
