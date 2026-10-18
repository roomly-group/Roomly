import * as zod from "zod";
import { LISTING_SERVIZI_OPTIONS } from "./constants";

// ===================== CONFIGURATION =====================

/**
 * Values of the Postgres enums used by `public.stanze`.
 * They must match the database enums exactly, otherwise Supabase rejects the write.
 */
export const ROOM_DB_ENUM_VALUES = {
  /** `tipologia_proprieta_enum` (column `tipologia_proprieta`). */
  tipologiaProprieta: ["appartamento", "stanza", "residenza"],
  /**
   * `taglio_appartamento_enum` (column `taglio_appartamento`).
   * The database only accepts it when `tipologia_proprieta = 'appartamento'` (stanze_taglio_check).
   */
  taglioAppartamento: ["monolocale", "bilocale", "trilocale", "quadrilocale", "cinque_o_piu_locali"],
  /** `mobili_inclusi_enum` (column `mobili_inclusi`). */
  mobiliInclusi: ["si", "no"],
  /** `spesa_inclusa_enum` (column `spese_incluse`, array). */
  speseIncluse: ["luce", "acqua", "gas", "wifi", "riscaldamento", "condominio", "rifiuti"],
  /** `elettrodomestico_enum` (column `elettrodomestici`, array). */
  elettrodomestici: [
    "lavatrice",
    "asciugatrice",
    "lavastoviglie",
    "forno",
    "piano_cottura",
    "microonde",
    "frigorifero",
    "congelatore",
    "aria_condizionata",
    "caldaia_centralizzata",
    "tv",
  ],
  /** `arredo_enum` (column `arredi`, array). */
  arredi: [
    "letto",
    "materasso",
    "armadio",
    "scrivania",
    "sedia",
    "comodino",
    "libreria",
    "divano",
    "tavolo",
    "cucina_attrezzata",
    "balcone",
  ],
} as const;

/**
 * Feature groups shown in the listing form and on the listing page, in display order.
 * Each key is the `public.stanze` array column the group is saved in; each value lists
 * the options of that group (the DB enum values, or `LISTING_SERVIZI_OPTIONS` for `servizi`).
 */
export const LISTING_FEATURE_GROUPS = {
  spese_incluse: ROOM_DB_ENUM_VALUES.speseIncluse,
  elettrodomestici: ROOM_DB_ENUM_VALUES.elettrodomestici,
  arredi: ROOM_DB_ENUM_VALUES.arredi,
  servizi: LISTING_SERVIZI_OPTIONS,
} as const;

/** `mobili_inclusi` values written for the "Furnished" (arredi group) switch (on / off). */
const FURNISHED_DB_VALUE = { on: "si", off: "no" } as const;

/** `spese_incluse` value that means "Wi-Fi included". */
const WIFI_DB_VALUE = "wifi" as const;

/** `tipologia_proprieta` value that allows a `taglio_appartamento` (stanze_taglio_check). */
export const APARTMENT_PROPERTY_TYPE = "appartamento" as const;

/**
 * Columns of `public.stanze` that hold the listing features.
 * Add this to every Supabase `.select()` that needs them.
 */
export const ROOM_FEATURE_COLUMNS =
  "tipologia_proprieta, taglio_appartamento, mobili_inclusi, animali_consentiti, fumatori_consentiti, spese_incluse, elettrodomestici, arredi, servizi" as const;

// ===================== TYPES =====================

export type RoomTipologiaProprieta = (typeof ROOM_DB_ENUM_VALUES.tipologiaProprieta)[number];
export type RoomTaglioAppartamento = (typeof ROOM_DB_ENUM_VALUES.taglioAppartamento)[number];
export type RoomMobiliInclusi = (typeof ROOM_DB_ENUM_VALUES.mobiliInclusi)[number];
export type RoomSpesaInclusa = (typeof ROOM_DB_ENUM_VALUES.speseIncluse)[number];
export type RoomElettrodomestico = (typeof ROOM_DB_ENUM_VALUES.elettrodomestici)[number];
export type RoomArredo = (typeof ROOM_DB_ENUM_VALUES.arredi)[number];
export type ListingServizio = (typeof LISTING_SERVIZI_OPTIONS)[number];
export type ListingFeatureGroup = keyof typeof LISTING_FEATURE_GROUPS;

/** Selected options of every feature group, keyed by `public.stanze` column. */
export type RoomFeatureGroups = {
  spese_incluse: RoomSpesaInclusa[];
  elettrodomestici: RoomElettrodomestico[];
  arredi: RoomArredo[];
  servizi: ListingServizio[];
};

/** Features as the app (listing form, API `Listing`) represents them. */
export type ListingFeatures = {
  /** `tipologia_proprieta`, `null` when not specified. */
  propertyType: RoomTipologiaProprieta | null;
  /** `taglio_appartamento`, only for apartments (`null` otherwise). */
  apartmentLayout: RoomTaglioAppartamento | null;
  /** `mobili_inclusi = 'si'`: the switch of the "arredi" group. */
  furnished: boolean;
  /** `animali_consentiti`. */
  petsAllowed: boolean;
  /** `fumatori_consentiti`. */
  smokersAllowed: boolean;
  features: RoomFeatureGroups;
};

/** Feature columns of a `public.stanze` row, as written to / read from Supabase. */
export type RoomFeatureColumns = {
  tipologia_proprieta: RoomTipologiaProprieta | null;
  taglio_appartamento: RoomTaglioAppartamento | null;
  mobili_inclusi: RoomMobiliInclusi | null;
  animali_consentiti: boolean | null;
  fumatori_consentiti: boolean | null;
  spese_incluse: RoomSpesaInclusa[];
  elettrodomestici: RoomElettrodomestico[];
  arredi: RoomArredo[];
  servizi: string[];
};

// ===================== VALIDATION =====================

/** Validates the feature groups sent by the client: only known options, no duplicates. */
export const ListingFeatureGroupsSchema = zod.object({
  spese_incluse: zod.array(zod.enum(ROOM_DB_ENUM_VALUES.speseIncluse)).max(ROOM_DB_ENUM_VALUES.speseIncluse.length).default([]),
  elettrodomestici: zod.array(zod.enum(ROOM_DB_ENUM_VALUES.elettrodomestici)).max(ROOM_DB_ENUM_VALUES.elettrodomestici.length).default([]),
  arredi: zod.array(zod.enum(ROOM_DB_ENUM_VALUES.arredi)).max(ROOM_DB_ENUM_VALUES.arredi.length).default([]),
  servizi: zod.array(zod.enum(LISTING_SERVIZI_OPTIONS)).max(LISTING_SERVIZI_OPTIONS.length).default([]),
});

/** Validates the `tipologia_proprieta` sent by the client (`null` = not specified). */
export const ListingPropertyTypeSchema = zod.enum(ROOM_DB_ENUM_VALUES.tipologiaProprieta).nullable();

/** Validates the `taglio_appartamento` sent by the client (`null` = not specified). */
export const ListingApartmentLayoutSchema = zod.enum(ROOM_DB_ENUM_VALUES.taglioAppartamento).nullable();

// ===================== HELPERS =====================

/** Supabase can return `null` for arrays on old rows: always work with a real array. */
const asArray = <T>(value: readonly T[] | null | undefined): T[] =>
  Array.isArray(value) ? [...value] : [];

/** Keeps only the known options of a group, without duplicates, in display order. */
const pickOptions = <T extends string>(options: readonly T[], values: readonly string[]): T[] =>
  options.filter((option) => values.includes(option));

/** Empty selection for every feature group. */
export const emptyListingFeatureGroups = (): RoomFeatureGroups => ({
  spese_incluse: [],
  elettrodomestici: [],
  arredi: [],
  servizi: [],
});

/** Reads the listing features from the `public.stanze` feature columns. */
export const roomColumnsToListingFeatures = (
  row: Partial<RoomFeatureColumns> | null | undefined,
): ListingFeatures => {
  const propertyType =
    ROOM_DB_ENUM_VALUES.tipologiaProprieta.find((value) => value === row?.tipologia_proprieta) ?? null;
  return {
    propertyType,
    // The layout only makes sense for apartments (stanze_taglio_check).
    apartmentLayout:
      propertyType === APARTMENT_PROPERTY_TYPE
        ? ROOM_DB_ENUM_VALUES.taglioAppartamento.find((value) => value === row?.taglio_appartamento) ?? null
        : null,
    furnished: row?.mobili_inclusi === FURNISHED_DB_VALUE.on,
    petsAllowed: row?.animali_consentiti === true,
    smokersAllowed: row?.fumatori_consentiti === true,
    features: {
      spese_incluse: pickOptions(LISTING_FEATURE_GROUPS.spese_incluse, asArray(row?.spese_incluse)),
      elettrodomestici: pickOptions(LISTING_FEATURE_GROUPS.elettrodomestici, asArray(row?.elettrodomestici)),
      arredi: pickOptions(LISTING_FEATURE_GROUPS.arredi, asArray(row?.arredi)),
      servizi: pickOptions(LISTING_FEATURE_GROUPS.servizi, asArray(row?.servizi)),
    },
  };
};

/** True when "Wi-Fi" is among the included bills (kept for the `wifi` field of `Listing`). */
export const hasWifiIncluded = (features: RoomFeatureGroups): boolean =>
  features.spese_incluse.includes(WIFI_DB_VALUE);

/**
 * Converts the listing features into the columns to write to `public.stanze`.
 *
 * `servizi` is free text in the database: values not managed by the form
 * (set elsewhere) are kept from `currentServizi`. Pass `[]` for a new room.
 * When the room is not furnished the furniture list is emptied, and the layout
 * is only kept for apartments (the database rejects it otherwise).
 */
export const listingFeaturesToRoomColumns = (
  features: ListingFeatures,
  currentServizi: readonly string[] | null | undefined = [],
): RoomFeatureColumns => {
  const managedServizi: readonly string[] = LISTING_SERVIZI_OPTIONS;
  const otherServizi = asArray(currentServizi).filter((value) => !managedServizi.includes(value));

  return {
    tipologia_proprieta: features.propertyType,
    taglio_appartamento:
      features.propertyType === APARTMENT_PROPERTY_TYPE ? features.apartmentLayout : null,
    mobili_inclusi: features.furnished ? FURNISHED_DB_VALUE.on : FURNISHED_DB_VALUE.off,
    animali_consentiti: features.petsAllowed,
    fumatori_consentiti: features.smokersAllowed,
    spese_incluse: pickOptions(LISTING_FEATURE_GROUPS.spese_incluse, features.features.spese_incluse),
    elettrodomestici: pickOptions(LISTING_FEATURE_GROUPS.elettrodomestici, features.features.elettrodomestici),
    arredi: features.furnished ? pickOptions(LISTING_FEATURE_GROUPS.arredi, features.features.arredi) : [],
    servizi: [...otherServizi, ...pickOptions(LISTING_FEATURE_GROUPS.servizi, features.features.servizi)],
  };
};
