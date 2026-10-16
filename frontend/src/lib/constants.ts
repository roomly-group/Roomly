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
  ROOMS: '/rooms',
  ROOM_DETAIL: '/rooms/:id',
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

/** Position shown when the waitlist-position endpoint cannot provide a value (place). */
export const WAITLIST_FALLBACK_POSITION = 107 as const;

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

export const gradients = [
  'from-[#a6dfca] via-[#dff3df] to-[#f1efe8]',
  'from-[#f3cd8c] via-[#f1efe8] to-[#c7e9dc]',
  'from-[#d7c9e9] via-[#f1efe8] to-[#9fe1cb]',
  'from-[#b6d9eb] via-[#f1efe8] to-[#f0c9a2]',
];

export function formatPrice(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Caratteristiche selezionabili in 'Aggiungi annuncio' (valore salvato in `servizi`).
export const LISTING_AMENITIES = ['lavatrice', 'aria_condizionata', 'riscaldamento', 'balcone', 'bagno_privato', 'cucina', 'spese_incluse', 'animali', 'scrivania', 'ascensore'] as const;
