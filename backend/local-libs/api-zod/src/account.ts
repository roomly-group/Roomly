// Account deletion and personal-data export (GDPR Art. 15, 17, 20).
// Shared by the backend (routes/me.ts) and the frontend (pages/profile.tsx).

// ===================== CONFIGURATION =====================

/**
 * Value the frontend sends in the DELETE /api/me body once the user has typed
 * the confirmation word. Stops an accidental or empty call from deleting an account.
 */
export const ACCOUNT_DELETE_CONFIRMATION = "DELETE_MY_ACCOUNT" as const;

/** `code` values of the DELETE /api/me error responses, matched by the frontend. */
export const ACCOUNT_DELETE_ERROR_CODES = {
  /** The user last logged in too long ago: they must log in again first. */
  REAUTH_REQUIRED: "reauth_required",
  /** The user has a contract that is not cancelled: deletion is refused. */
  HAS_CONTRACTS: "has_contracts",
  /** The body did not carry ACCOUNT_DELETE_CONFIRMATION. */
  CONFIRMATION_REQUIRED: "confirmation_required",
} as const;

/**
 * How a user proves it is them before changing their email (GET /api/me/email).
 * PASSWORD: accounts with a password. CODE: accounts without one (signed up
 * with Google), which get a one-time code at their current address instead.
 */
export const EMAIL_CHANGE_METHODS = {
  PASSWORD: "password",
  CODE: "code",
} as const;
export type EmailChangeMethod = (typeof EMAIL_CHANGE_METHODS)[keyof typeof EMAIL_CHANGE_METHODS];

/** `code` values of the PATCH /api/me/email and POST /api/me/email/code error responses, matched by the frontend. */
export const EMAIL_CHANGE_ERROR_CODES = {
  /** The current password is wrong. */
  WRONG_PASSWORD: "wrong_password",
  /** The emailed code is wrong or expired. */
  WRONG_CODE: "wrong_code",
  /** The Turnstile check is missing, expired or already used. */
  CAPTCHA_FAILED: "captcha_failed",
  /** Another account already uses the new address. */
  EMAIL_IN_USE: "email_in_use",
  /** The new address is not a valid email, or is the current one. */
  INVALID_EMAIL: "invalid_email",
  /** The proof sent does not match the account (e.g. a password for a Google-only account). */
  WRONG_METHOD: "wrong_method",
  /** Supabase refused to send another email for now. */
  TOO_MANY_REQUESTS: "too_many_requests",
} as const;

/** Message type of a text whose author deleted their account (`messaggi.tipo`). */
export const DELETED_MESSAGE_TYPE = "eliminato" as const;
