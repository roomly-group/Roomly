import {
  APARTMENT_PROPERTY_TYPE,
  LISTING_FEATURE_GROUPS,
  ROOM_DB_ENUM_VALUES,
  type ListingFeatureGroup,
} from '@workspace/api-zod';

// ===================== CONFIGURATION =====================

/** Frontend navigation paths used by the Wouter router and page links. */
export const APP_ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  HOME: '/home',
  SEARCH: '/search',
  LISTINGS: '/listings',
  OWNER_LISTINGS: '/owner/listings',
  LISTING_DETAIL: '/listings/:id',
  MESSAGES: '/messages',
  MESSAGE_DETAIL: '/messages/:id?',
  OWNER_MESSAGES: '/owner/messages',
  OWNER_MESSAGE_DETAIL: '/owner/messages/:id?',
  PROFILE: '/profile',
  PROFILE_PREFERENCES: '/profile/preferences',
  OWNER_LISTING_NEW: '/owner/listings/new',
  OWNER_PROFILE: '/owner/profile',
  OWNER_PROFILE_PREFERENCES: '/owner/profile/preferences',
  OWNER_LISTING_EDIT: '/owner/listings/:id/edit',
  OWNER_DASHBOARD: '/owner',
  WAITLIST: '/waitlist',
  WAITLIST_CONFIRMED: '/waitlist/confirmed',
  ONBOARDING: '/onboarding',
  ABOUT: '/chi-siamo',
  CONTACT: '/contatti',
  PRIVACY: '/privacy',
  TERMS: '/termini',
  COOKIES: '/cookie',
} as const;

/** FAQ anchor URL linked from the footer (path and hash). */
export const WAITLIST_FAQ_ANCHOR_URL = '/#faq' as const;

/** Social profile destinations shared by footer and contact-page links. */
export const SOCIAL_PROFILE_URLS = {
  INSTAGRAM: 'https://www.instagram.com/roomlygroup',
  LINKEDIN: 'https://www.linkedin.com/in/daniele-vinciguerra-6588773a8/',
  TIKTOK: 'https://www.tiktok.com/@roomlygroup',
} as const;

/** Mask displayed in password and confirmation fields (placeholder text). */
export const PASSWORD_FIELD_PLACEHOLDER = '••••••••' as const;

/** Stable selectors shared by authentication and search controls. */
export const SHARED_TEST_IDS = {
  BUTTON_SEARCH: 'button-search',
  INPUT_EMAIL: 'input-email',
  INPUT_PASSWORD: 'input-password',
  LINK_LOGO: 'link-logo',
} as const;


/** Default price placeholder shared by listing creation and editing (display text). */
export const LISTING_PRICE_PLACEHOLDER = '720' as const;

/** Left padding for the currency symbol in the listing price input (px). */
export const LISTING_PRICE_INPUT_PADDING_LEFT_PX = 36 as const;

/** Highest entry delay token used by listing and owner dashboard cards (animation step). */
export const MAX_PAGE_ENTRY_DELAY_INDEX = 3 as const;

/** Stable selectors shared by listing creation and editing forms. */
export const LISTING_FORM_TEST_IDS = {
  LINK_BACK_OWNER: 'link-back-owner',
  INPUT_LISTING_TITLE: 'input-listing-title',
  INPUT_LISTING_PRICE: 'input-listing-price',
  TEXTAREA_LISTING_DESCRIPTION: 'textarea-listing-description',
  BUTTON_PUBLISH_LISTING: 'button-publish-listing',
  INPUT_LISTING_PHOTOS: 'input-listing-photos',
  BUTTON_UPDATE_LISTING: 'button-update-listing',
} as const;

/** Stable selectors shared by current and legacy listing-detail pages. */
export const LISTING_DETAIL_TEST_IDS = {
  LINK_BACK_SEARCH: 'link-back-search',
  BUTTON_LISTING_COVER_PHOTO: 'button-listing-cover-photo',
  BUTTON_SAVE_DETAIL: 'button-save-detail',
  GALLERY_LISTING_PHOTOS: 'gallery-listing-photos',
  BUTTON_LISTING_PHOTO_PREFIX: 'button-listing-photo-',
  LIGHTBOX_LISTING_PHOTO: 'lightbox-listing-photo',
  BUTTON_CLOSE_PHOTO_LIGHTBOX: 'button-close-photo-lightbox',
  BUTTON_PREVIOUS_PHOTO: 'button-previous-photo',
  IMAGE_PHOTO_LIGHTBOX_FULL: 'image-photo-lightbox-full',
  BUTTON_NEXT_PHOTO: 'button-next-photo',
  LINK_ACCEPTED_CHAT: 'link-accepted-chat',
  LINK_EXISTING_CHAT: 'link-existing-chat',
  BUTTON_CONTACT_OWNER: 'button-contact-owner',
  STATUS_OWN_LISTING: 'status-own-listing',
  BUTTON_CLOSE_CONTACT: 'button-close-contact',
  INPUT_FIRST_MESSAGE: 'input-first-message',
  STATUS_CONTACT_ERROR: 'status-contact-error',
  BUTTON_CONTACT_SEND: 'button-contact-send',
} as const;

export const zones = [
  'North Campus',
  'Riverside',
  'Old Town',
  'Southbank',
  'Maple Quarter',
] as const;

export const zoneTranslationKeys: Record<
  string,
  | 'zones.northCampus'
  | 'zones.riverside'
  | 'zones.oldTown'
  | 'zones.southbank'
  | 'zones.mapleQuarter'
> = {
  'North Campus': 'zones.northCampus',
  'Riverside': 'zones.riverside',
  'Old Town': 'zones.oldTown',
  'Southbank': 'zones.southbank',
  'Maple Quarter': 'zones.mapleQuarter',
};

/** Pastel placeholder fills for rooms without photos, picked by listing id so card and detail match. */
export const gradients = [
  'from-mint-wash via-mint-mist to-cream',
  'from-sun/45 via-cream to-mint-mist',
  'from-mint-mist via-cream to-mint-wash',
  'from-sun/30 via-cream to-mint-wash/70',
];

/** Listing grid: 1 → 2 (640px) → 3 (900px) → 4 (1180px) columns; columns drop, rows never reflow. */
export const LISTING_GRID_CLASS = 'grid gap-x-6 gap-y-10 sm:grid-cols-2 laptop:grid-cols-3 desk:grid-cols-4';

/** Number-format locale per UI language: prices and distances follow the reader ("420 €" in Italian, "€420" in English). */
const NUMBER_LOCALES: Record<string, string> = {
  it: 'it-IT',
  en: 'en-IE',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-PT',
};

const numberLocale = (language: string) => NUMBER_LOCALES[language] ?? NUMBER_LOCALES.it;

export function formatPrice(value: number, language: string) {
  return new Intl.NumberFormat(numberLocale(language), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Distance in km with one decimal under 10 km ("1,2"), whole numbers above ("14"). */
export function formatKm(value: number, language: string) {
  return new Intl.NumberFormat(numberLocale(language), {
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}

/** Short date ("18 ott") in the reader's language. */
export function formatShortDate(value: string | Date, language: string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(numberLocale(language), { day: 'numeric', month: 'short' }).format(date);
}

/** Month and year ("Settembre 2027") in the reader's language, capitalised for use as a label. */
export function formatMonthYear(date: Date, language: string) {
  const label = new Intl.DateTimeFormat(numberLocale(language), { month: 'long', year: 'numeric' }).format(date);
  return label.charAt(0).toLocaleUpperCase(numberLocale(language)) + label.slice(1);
}

/** Default search radius around a university (km). Mirrors the backend's SEARCH_RADIUS_KM default. */
export const SEARCH_RADIUS_KM = 80 as const;

export function initials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Gruppi di caratteristiche dell'annuncio (chiave = colonna di `stanze`, valori = enum del database),
// mostrati in quest'ordine nel form 'Aggiungi / Modifica annuncio' e nella pagina dell'annuncio.
export const LISTING_FEATURE_GROUP_OPTIONS = LISTING_FEATURE_GROUPS;
export const LISTING_FEATURE_GROUP_KEYS = Object.keys(LISTING_FEATURE_GROUPS) as ListingFeatureGroup[];
// Il gruppo 'arredi' si accende/spegne con "Arredata" (colonna `mobili_inclusi`).
export const LISTING_FURNITURE_GROUP: ListingFeatureGroup = 'arredi';
// Tipologie selezionabili (enum `tipologia_proprieta_enum`).
export const LISTING_PROPERTY_TYPES = ROOM_DB_ENUM_VALUES.tipologiaProprieta;
// Tagli selezionabili (enum `taglio_appartamento_enum`), solo per la tipologia 'appartamento'.
export const LISTING_APARTMENT_LAYOUTS = ROOM_DB_ENUM_VALUES.taglioAppartamento;
export const LISTING_APARTMENT_PROPERTY_TYPE = APARTMENT_PROPERTY_TYPE;
