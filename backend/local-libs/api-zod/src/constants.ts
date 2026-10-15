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
  ME_ROLE: "/me/role",
  ME: "/me",
  ME_LANGUAGE: "/me/language",
  WAITLIST_COUNT: "/waitlist/count",
  WAITLIST_ME: "/waitlist/me",
  LOGIN: "/login",
  REFRESH: "/refresh",
  VERIFY: "/verify",
  LOGOUT: "/logout",
  AUTH_CONFIG: "/config",
  REGISTER: "/register",
  SESSION: "/session",
  UNIVERSITIES: "/universita",
} as const;

/** Language codes accepted by backend profile settings and frontend localization (locale codes). */
export const SUPPORTED_LANGUAGE_CODES = ["en", "it", "es", "fr", "de", "pt"] as const;

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
