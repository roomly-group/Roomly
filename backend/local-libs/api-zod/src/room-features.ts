import { LISTING_AMENITY_OPTIONS } from "./constants";

// ===================== CONFIGURATION =====================

/**
 * Values of the Postgres enums used by `public.stanze`.
 * They must match the database enums exactly, otherwise Supabase rejects the write.
 */
export const ROOM_DB_ENUM_VALUES = {
  /** `stanze_tipo_enum` (column `tipo`). */
  tipo: [
    "monolocale",
    "bilocale",
    "trilocale",
    "quadrilocale",
    "stanza singola",
    "stanza doppia",
    "stanza tripla",
    "stanza quadrupla",
  ],
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

export type RoomTipo = (typeof ROOM_DB_ENUM_VALUES.tipo)[number];
export type RoomMobiliInclusi = (typeof ROOM_DB_ENUM_VALUES.mobiliInclusi)[number];
export type RoomSpesaInclusa = (typeof ROOM_DB_ENUM_VALUES.speseIncluse)[number];
export type RoomElettrodomestico = (typeof ROOM_DB_ENUM_VALUES.elettrodomestici)[number];
export type RoomArredo = (typeof ROOM_DB_ENUM_VALUES.arredi)[number];
export type ListingAmenity = (typeof LISTING_AMENITY_OPTIONS)[number];

/** `mobili_inclusi` values written for the "Furnished" toggle (on / off). */
const FURNISHED_DB_VALUE = { on: "si", off: "no" } as const satisfies Record<string, RoomMobiliInclusi>;

/** `spese_incluse` value written for the "Wi-Fi included" toggle. */
const WIFI_DB_VALUE: RoomSpesaInclusa = "wifi";

/**
 * Columns of `public.stanze` that hold the listing features.
 * Add this to every Supabase `.select()` that needs furnished / wifi / amenities.
 */
export const ROOM_FEATURE_COLUMNS =
  "mobili_inclusi, animali_consentiti, spese_incluse, elettrodomestici, arredi, servizi" as const;

/**
 * Where each listing-form amenity is stored in `public.stanze`.
 * - Enum array columns store the listed enum values (all of them must be present to count as "on").
 * - `servizi` (text[]) keeps the amenities that have no enum in the database.
 * - `animali_consentiti` is a plain boolean.
 */
const LISTING_AMENITY_STORAGE = {
  lavatrice: { column: "elettrodomestici", values: ["lavatrice"] },
  aria_condizionata: { column: "elettrodomestici", values: ["aria_condizionata"] },
  riscaldamento: { column: "spese_incluse", values: ["riscaldamento"] },
  balcone: { column: "arredi", values: ["balcone"] },
  bagno_privato: { column: "servizi", values: ["bagno_privato"] },
  cucina: { column: "arredi", values: ["cucina_attrezzata"] },
  spese_incluse: { column: "spese_incluse", values: ["luce", "acqua", "gas"] },
  animali: { column: "animali_consentiti" },
  scrivania: { column: "arredi", values: ["scrivania"] },
  ascensore: { column: "servizi", values: ["ascensore"] },
} as const satisfies Record<ListingAmenity, AmenityStorage>;

// ===================== TYPES =====================

/** Array columns of `public.stanze` that can hold amenity values. */
type RoomFeatureArrayColumn = "spese_incluse" | "elettrodomestici" | "arredi" | "servizi";

type AmenityStorage =
  | { column: "spese_incluse"; values: readonly RoomSpesaInclusa[] }
  | { column: "elettrodomestici"; values: readonly RoomElettrodomestico[] }
  | { column: "arredi"; values: readonly RoomArredo[] }
  | { column: "servizi"; values: readonly string[] }
  | { column: "animali_consentiti" };

/** Feature columns of a `public.stanze` row, as written to / read from Supabase. */
export type RoomFeatureColumns = {
  mobili_inclusi: RoomMobiliInclusi | null;
  animali_consentiti: boolean | null;
  spese_incluse: RoomSpesaInclusa[];
  elettrodomestici: RoomElettrodomestico[];
  arredi: RoomArredo[];
  servizi: string[];
};

/** Features as the app (listing form, API `Listing`) represents them. */
export type ListingFeatures = {
  furnished: boolean;
  wifi: boolean;
  amenities: ListingAmenity[];
};

/** Feature columns of a brand-new room: nothing selected yet. */
const EMPTY_ROOM_FEATURE_COLUMNS: RoomFeatureColumns = {
  mobili_inclusi: null,
  animali_consentiti: null,
  spese_incluse: [],
  elettrodomestici: [],
  arredi: [],
  servizi: [],
};

// ===================== HELPERS =====================

/** Supabase can return `null` for arrays on old rows: always work with a real array. */
const asArray = <T>(value: readonly T[] | null | undefined): T[] =>
  Array.isArray(value) ? [...value] : [];

/** Normalizes a (possibly partial) Supabase row into complete feature columns. */
const normalizeRoomFeatureColumns = (
  row: Partial<RoomFeatureColumns> | null | undefined,
): RoomFeatureColumns => ({
  mobili_inclusi: row?.mobili_inclusi ?? null,
  animali_consentiti: row?.animali_consentiti ?? null,
  spese_incluse: asArray(row?.spese_incluse),
  elettrodomestici: asArray(row?.elettrodomestici),
  arredi: asArray(row?.arredi),
  servizi: asArray(row?.servizi),
});

/**
 * Reads the listing features (furnished / wifi / amenities) from the
 * `public.stanze` feature columns.
 */
export const roomColumnsToListingFeatures = (
  row: Partial<RoomFeatureColumns> | null | undefined,
): ListingFeatures => {
  const columns = normalizeRoomFeatureColumns(row);
  const columnValues: Record<RoomFeatureArrayColumn, readonly string[]> = columns;

  const amenities = LISTING_AMENITY_OPTIONS.filter((amenity) => {
    const storage: AmenityStorage = LISTING_AMENITY_STORAGE[amenity];
    if (storage.column === "animali_consentiti") return columns.animali_consentiti === true;
    return storage.values.every((value) => columnValues[storage.column].includes(value));
  });

  return {
    furnished: columns.mobili_inclusi === FURNISHED_DB_VALUE.on,
    wifi: columns.spese_incluse.includes(WIFI_DB_VALUE),
    amenities,
  };
};

/**
 * Applies the listing features to the current feature columns of a room and
 * returns the columns to write to `public.stanze`.
 *
 * Only the values of features that actually changed are added / removed, so
 * values set outside the listing form (e.g. `tv`, `condominio`) are kept.
 * Pass `null` as `current` when creating a new room.
 */
export const applyListingFeatures = (
  current: Partial<RoomFeatureColumns> | null,
  features: ListingFeatures,
): RoomFeatureColumns => {
  const before = roomColumnsToListingFeatures(current ?? EMPTY_ROOM_FEATURE_COLUMNS);
  const result = normalizeRoomFeatureColumns(current ?? EMPTY_ROOM_FEATURE_COLUMNS);
  const arrays: Record<RoomFeatureArrayColumn, string[]> = result;

  // Adds or removes the values of one feature, only when its on/off state changed.
  const toggle = (
    column: RoomFeatureArrayColumn,
    values: readonly string[],
    wasOn: boolean,
    isOn: boolean,
  ) => {
    if (wasOn === isOn) return;
    arrays[column] = isOn
      ? [...new Set([...arrays[column], ...values])]
      : arrays[column].filter((value) => !values.includes(value));
  };

  toggle("spese_incluse", [WIFI_DB_VALUE], before.wifi, features.wifi);

  for (const amenity of LISTING_AMENITY_OPTIONS) {
    const storage: AmenityStorage = LISTING_AMENITY_STORAGE[amenity];
    if (storage.column === "animali_consentiti") continue;
    toggle(
      storage.column,
      storage.values,
      before.amenities.includes(amenity),
      features.amenities.includes(amenity),
    );
  }

  // Binary toggles in the form: always stored explicitly.
  result.mobili_inclusi = features.furnished ? FURNISHED_DB_VALUE.on : FURNISHED_DB_VALUE.off;
  result.animali_consentiti = features.amenities.includes("animali");

  return result;
};
