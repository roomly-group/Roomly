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

/** Message type of a text whose author deleted their account (`messaggi.tipo`). */
export const DELETED_MESSAGE_TYPE = "eliminato" as const;
