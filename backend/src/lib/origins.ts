// ===================== CONFIGURATION =====================

/** Production origin of the frontend. */
export const PRODUCTION_ORIGIN = "https://www.roomly.group" as const;
/** Local development origin of the frontend. */
export const LOCALHOST_ORIGIN = "http://localhost:5173" as const;
/** Loopback development origin of the frontend. */
export const LOOPBACK_ORIGIN = "http://127.0.0.1:5173" as const;

/** Frontend origins this backend serves: used by CORS and to build links back to the app. */
export const ALLOWED_ORIGINS: readonly string[] = process.env.NODE_ENV === "production"
  ? [PRODUCTION_ORIGIN]
  : [LOCALHOST_ORIGIN, LOOPBACK_ORIGIN];

export function isAllowedOrigin(origin: string | undefined): origin is string {
  return typeof origin === "string" && ALLOWED_ORIGINS.includes(origin);
}
