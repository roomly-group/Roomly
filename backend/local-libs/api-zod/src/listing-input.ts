import * as zod from "zod";
import {
  ListingApartmentLayoutSchema,
  ListingFeatureGroupsSchema,
  ListingPropertyTypeSchema,
} from "./room-features";

// One schema for the listing form, used by BOTH POST /api/listings (create)
// and PUT /api/owner/listings/:id (edit) (RMY-16). Before, the edit route
// read req.body by hand: address/city/postcode/coordinates were never checked
// and nothing had a length or price limit, so a too-long title or a huge
// price reached the database and came back as a 500 instead of a clear 400.
// The frontend forms use the same limits (maxLength / max on the inputs).

// ===================== CONFIGURATION =====================

/** Limits of the listing form. The text limits match the DB columns where one exists (stanze). */
export const LISTING_INPUT_LIMITS = {
  /** stanze.titolo is varchar(200). */
  TITLE_MAX_CHARS: 200,
  /** stanze.descrizione is text: this only bounds the request size. */
  DESCRIPTION_MAX_CHARS: 5000,
  /** stanze.indirizzo is varchar(255). */
  ADDRESS_MAX_CHARS: 255,
  /** stanze.citta is varchar(50). */
  CITY_MAX_CHARS: 50,
  /** University name sent as `zone` by old clients (universita.nome). */
  ZONE_MAX_CHARS: 200,
  /** Monthly rent, euro. */
  PRICE_MIN_EUR: 1,
  PRICE_MAX_EUR: 20_000,
} as const;

/** Italian postcode (CAP): 5 digits. Addresses are picked in Italy only (AddressAutocomplete). */
export const LISTING_POSTCODE_PATTERN = /^\d{5}$/;

// ===================== SCHEMA =====================

/** Optional trimmed text with a max length; empty becomes undefined (stored as NULL). */
const optionalText = (max: number) =>
  zod
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/** Body of POST /api/listings and PUT /api/owner/listings/:id. Unknown keys are dropped. */
export const ListingInputBody = zod.object({
  title: zod.string().trim().min(1).max(LISTING_INPUT_LIMITS.TITLE_MAX_CHARS),
  description: zod.string().trim().min(1).max(LISTING_INPUT_LIMITS.DESCRIPTION_MAX_CHARS),
  price: zod.number().finite().min(LISTING_INPUT_LIMITS.PRICE_MIN_EUR).max(LISTING_INPUT_LIMITS.PRICE_MAX_EUR),
  zone: optionalText(LISTING_INPUT_LIMITS.ZONE_MAX_CHARS),
  address: optionalText(LISTING_INPUT_LIMITS.ADDRESS_MAX_CHARS),
  city: optionalText(LISTING_INPUT_LIMITS.CITY_MAX_CHARS),
  // Some addresses come back without a postcode: empty is allowed.
  postcode: zod
    .string()
    .trim()
    .optional()
    .refine((value) => !value || LISTING_POSTCODE_PATTERN.test(value))
    .transform((value) => (value ? value : undefined)),
  // Numbers only: a string like "45.4" is refused instead of being coerced.
  // 0,0 means "no address picked" (the form's empty value).
  latitude: zod.number().finite().min(-90).max(90).optional(),
  longitude: zod.number().finite().min(-180).max(180).optional(),
  propertyType: ListingPropertyTypeSchema.optional(),
  apartmentLayout: ListingApartmentLayoutSchema.optional(),
  furnished: zod.boolean().optional(),
  petsAllowed: zod.boolean().optional(),
  smokersAllowed: zod.boolean().optional(),
  features: ListingFeatureGroupsSchema.optional(),
  /** Number of photos the create form is about to upload (informational). */
  photos: zod.number().int().min(0).optional(),
});

export type ListingInputBodyType = zod.infer<typeof ListingInputBody>;
