-- 004_stanze_feature_columns.sql
--
-- One-time DATA migration (no schema change).
-- Older rooms stored their features as free text in `stanze.servizi`
-- (e.g. 'arredato', 'internet', 'lavatrice', 'cucina', 'spese_incluse', 'animali').
-- The app now reads/writes them in the new columns, so this moves them there:
--   arredato / mobilio / letto / armadio -> mobili_inclusi = 'si'
--   animali                              -> animali_consentiti = true
--   *internet*                           -> spese_incluse 'wifi'
--   spese_incluse                        -> spese_incluse 'luce', 'acqua', 'gas'
--   cucina                               -> arredi 'cucina_attrezzata'
--   any value equal to an enum value     -> spese_incluse / elettrodomestici / arredi
-- Everything without an enum (e.g. bagno_privato, ascensore) stays in `servizi`.
--
-- Safe to run more than once. Run it once in the Supabase SQL editor
-- when the new backend/frontend are deployed.

BEGIN;

WITH legacy AS (
  SELECT
    s.id,
    ARRAY(SELECT lower(trim(v)) FROM unnest(s.servizi) AS v) AS servizi_lc
  FROM public.stanze AS s
  WHERE cardinality(s.servizi) > 0
)
UPDATE public.stanze AS s
SET
  -- "Furnished"
  mobili_inclusi = CASE
    WHEN l.servizi_lc && ARRAY['arredato', 'mobilio', 'letto', 'armadio'] THEN 'si'::public.mobili_inclusi_enum
    ELSE s.mobili_inclusi
  END,

  -- "Pets allowed"
  animali_consentiti = CASE
    WHEN 'animali' = ANY (l.servizi_lc) THEN true
    ELSE s.animali_consentiti
  END,

  -- "Wi-Fi included", "Heating", "Bills included" + any value already named like the enum
  spese_incluse = ARRAY(
    SELECT DISTINCT v FROM unnest(
      s.spese_incluse
      || ARRAY(
        SELECT x::public.spesa_inclusa_enum
        FROM unnest(l.servizi_lc) AS x
        WHERE x = ANY (enum_range(NULL::public.spesa_inclusa_enum)::text[])
      )
      || CASE
        WHEN EXISTS (SELECT 1 FROM unnest(l.servizi_lc) AS x WHERE x LIKE '%internet%')
          THEN ARRAY['wifi']::public.spesa_inclusa_enum[]
        ELSE '{}'::public.spesa_inclusa_enum[]
      END
      || CASE
        WHEN 'spese_incluse' = ANY (l.servizi_lc)
          THEN ARRAY['luce', 'acqua', 'gas']::public.spesa_inclusa_enum[]
        ELSE '{}'::public.spesa_inclusa_enum[]
      END
    ) AS v
  ),

  -- "Washing machine", "Air conditioning" + any value already named like the enum
  elettrodomestici = ARRAY(
    SELECT DISTINCT v FROM unnest(
      s.elettrodomestici
      || ARRAY(
        SELECT x::public.elettrodomestico_enum
        FROM unnest(l.servizi_lc) AS x
        WHERE x = ANY (enum_range(NULL::public.elettrodomestico_enum)::text[])
      )
    ) AS v
  ),

  -- "Balcony", "Desk", "Kitchen access" + any value already named like the enum
  arredi = ARRAY(
    SELECT DISTINCT v FROM unnest(
      s.arredi
      || ARRAY(
        SELECT (CASE WHEN x = 'cucina' THEN 'cucina_attrezzata' ELSE x END)::public.arredo_enum
        FROM unnest(l.servizi_lc) AS x
        WHERE x = 'cucina' OR x = ANY (enum_range(NULL::public.arredo_enum)::text[])
      )
    ) AS v
  ),

  -- Keep only the text features that have no enum column
  servizi = ARRAY(
    SELECT v FROM unnest(s.servizi) AS v
    WHERE lower(trim(v)) NOT IN ('arredato', 'mobilio', 'animali', 'cucina', 'spese_incluse')
      AND lower(trim(v)) NOT LIKE '%internet%'
      AND lower(trim(v)) <> ALL (enum_range(NULL::public.spesa_inclusa_enum)::text[])
      AND lower(trim(v)) <> ALL (enum_range(NULL::public.elettrodomestico_enum)::text[])
      AND lower(trim(v)) <> ALL (enum_range(NULL::public.arredo_enum)::text[])
  )
FROM legacy AS l
WHERE l.id = s.id;

COMMIT;
