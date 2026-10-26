// ===================== CONFIGURATION =====================

/** API prefix used by the backend mount and frontend request paths. */
export const API_BASE_PATH = "/api" as const;

/** API route suffixes shared by backend route registration and frontend requests. */
export const API_ROUTE_PATHS = {
  HEALTH: "/healthz",
  LISTINGS: "/listings",
  LISTING_BY_ID: "/listings/:id",
  LISTING_RELEASE: "/listings/:id/release",
  CONVERSATIONS: "/conversations",
  CONVERSATION_MESSAGES: "/conversations/:id/messages",
  CONVERSATION_ACCEPT: "/conversations/:id/accept",
  CONVERSATION_REJECT: "/conversations/:id/reject",
  CONVERSATION_CANCEL: "/conversations/:id/cancel",
  CONVERSATION_DELETE: "/conversations/:id",
  OWNER_DASHBOARD: "/dashboard/owner",
  OWNER_LISTINGS: "/owner/listings",
  OWNER_LISTING_BY_ID: "/owner/listings/:id",
  OWNER_LISTING_PHOTOS: "/owner/listings/:id/photos",
  OWNER_LISTING_PHOTO_BY_ID: "/owner/listings/:id/photos/:photoId",
  ME_ROLE: "/me/role",
  ME: "/me",
  ME_PROFILE: "/me/profile",
  ME_LANGUAGE: "/me/language",
  ME_PREFERENCES: "/me/preferences",
  ME_ONBOARDING: "/me/onboarding",
  ME_PHOTO: "/me/photo",
  ME_INVITE: "/me/invito",
  ME_INVITE_CLAIM: "/me/invito/usa",
  WAITLIST_COUNT: "/waitlist/count",
  WAITLIST_ME: "/waitlist/me",
  LOGIN: "/login",
  REFRESH: "/refresh",
  VERIFY: "/verify",
  LOGOUT: "/logout",
  AUTH_CONFIG: "/config",
  REGISTER: "/register",
  SESSION: "/session",
  CSRF: "/csrf",
  UNIVERSITIES: "/universita",
} as const;

/** Language codes accepted by backend profile settings and frontend localization (locale codes). */
export const SUPPORTED_LANGUAGE_CODES = ["en", "it", "es", "fr", "de", "pt"] as const;

/**
 * Values the listing form can save in `stanze.servizi` (text[], no Postgres enum).
 * The other feature groups use the database enums (see `room-features.ts`).
 */
export const LISTING_SERVIZI_OPTIONS = ["bagno_privato", "ascensore"] as const;

/** Values accepted by the public preference enums. */
export const USER_PREFERENCE_OPTIONS = {
  noise: ["silenzioso", "medio", "tollerante"],
  cleanliness: ["molto_ordinato", "abbastanza_ordinato", "tollerante"],
  schedule: ["notturno", "diurno", "flessibile"],
  studyHabits: ["silenzioso", "con_musica", "flessibile"],
} as const;

/** User-owned roommate preferences persisted in `public.preferenze_utenti`. */
export type UserPreferences = {
  budget_max: number | null;
  animali: boolean | null;
  fumatori: boolean | null;
  livello_rumore_preferito: (typeof USER_PREFERENCE_OPTIONS.noise)[number];
  ordine_pulizia: (typeof USER_PREFERENCE_OPTIONS.cleanliness)[number];
  orari_sosta: (typeof USER_PREFERENCE_OPTIONS.schedule)[number];
  abitudini_studio: (typeof USER_PREFERENCE_OPTIONS.studyHabits)[number];
};

/** Matches the defaults on `public.preferenze_utenti` for a new preference row. */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  budget_max: null,
  animali: null,
  fumatori: null,
  livello_rumore_preferito: "medio",
  ordine_pulizia: "abbastanza_ordinato",
  orari_sosta: "flessibile",
  abitudini_studio: "flessibile",
};

/** Cookie name read by the frontend CSRF header synchronizer and set by the backend (cookie key). */
export const CSRF_TOKEN_COOKIE_NAME = "csrf-token" as const;

/** Number of messages returned per message-history page in frontend and backend (messages). */
export const MESSAGES_PAGE_SIZE = 100 as const;

/** Maximum message body length enforced by the backend and message composer (characters). */
export const MESSAGE_MAX_LENGTH_CHARS = 2000 as const;

/** Maximum number of photos accepted per listing by frontend and backend (photos). */
export const ROOM_PHOTO_MAX_COUNT = 10 as const;

/** Maximum room-photo upload size enforced by frontend and backend (bytes). */
export const ROOM_PHOTO_MAX_SIZE_BYTES = 8388608 as const;

/** Maximum profile-photo upload size (bytes). The frontend shrinks photos well below this before uploading. */
export const PROFILE_PHOTO_MAX_SIZE_BYTES = 5242880 as const;

/** Answers saved by the signup onboarding (CHECK constraints in migrations/006_onboarding.sql). */
export const ONBOARDING_OPTIONS = {
  /** "Come ci hai scoperto?" → `utenti.fonte_scoperta`. */
  sources: ["instagram", "tiktok", "linkedin", "amico", "google", "ai", "facebook", "altro"],
  /** "Per quanto tempo?" → `utenti.durata_permanenza`. */
  stayDurations: ["semestre", "un_anno", "piu_anni", "non_so"],
  /** Monthly budget choices (€) → `preferenze_utenti.budget_max`. */
  budgets: [300, 400, 500, 600, 800, 1000],
} as const;

/** Places a user moves up the waitlist for each invited friend who finishes the onboarding. */
export const WAITLIST_INVITE_BONUS = 5 as const;

/** Query parameter carrying an invite code in links (/register?invito=CODE). */
export const INVITE_QUERY_PARAM = "invito" as const;

/** Minimum age to sign up (years). */
export const MINIMUM_SIGNUP_AGE_YEARS = 18 as const;

/** Maximum length of the short self-introduction (`utenti.bio`, characters). */
export const PROFILE_BIO_MAX_LENGTH_CHARS = 400 as const;
