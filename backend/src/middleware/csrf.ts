import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { API_ROUTE_PATHS, CSRF_HEADER_NAME, CSRF_INVALID_CODE, CSRF_TOKEN_COOKIE_NAME } from "@workspace/api-zod";
import { logger } from "../lib/logger.js";

// ===================== CONFIGURATION =====================

/** Methods that never change anything on the server: no CSRF check needed. */
const CSRF_SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);
/**
 * Routes (relative to /api) that skip the check. Login and signup run before
 * the browser has any session to abuse, and both are already guarded by the
 * Turnstile CAPTCHA, which another site cannot solve for the victim.
 */
const CSRF_EXEMPT_PATHS: readonly string[] = [API_ROUTE_PATHS.LOGIN, API_ROUTE_PATHS.REGISTER];
/** Status and body sent when the header is missing or wrong. */
const CSRF_REJECT_STATUS = 403 as const;
const CSRF_REJECT_MESSAGE = "CSRF token missing or invalid" as const;

/** SHA-256 digest, so timingSafeEqual always compares two values of equal length. */
const digest = (value: string): Buffer => crypto.createHash("sha256").update(value).digest();

/**
 * CSRF protection for every state-changing /api request (RMY-20), with the
 * "double submit cookie" pattern:
 * - the backend sets a random token in the `csrf-token` cookie (readable by
 *   our own pages, SameSite=Strict; see routes/auth.ts);
 * - our pages copy it into the X-CSRF-Token header (frontend/src/lib/csrf-fetch.ts);
 * - here the header must equal the cookie.
 *
 * Another website can make the browser SEND our cookies, but it can never
 * READ them, so it cannot write the matching header. SameSite=Lax on the
 * session cookies alone left gaps (e.g. top-level POSTs, sibling subdomains).
 *
 * Mounted on the /api router, so `req.path` is relative to /api.
 */
export function requireCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (CSRF_SAFE_METHODS.has(req.method) || CSRF_EXEMPT_PATHS.includes(req.path)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_TOKEN_COOKIE_NAME];
  const headerToken = req.get(CSRF_HEADER_NAME);
  const valid =
    typeof cookieToken === "string" &&
    cookieToken.length > 0 &&
    typeof headerToken === "string" &&
    crypto.timingSafeEqual(digest(cookieToken), digest(headerToken));

  if (!valid) {
    // No token values in the log: only what is needed to spot a broken client.
    logger.warn(
      { method: req.method, path: req.path, hasCookie: Boolean(cookieToken), hasHeader: Boolean(headerToken) },
      "CSRF check failed",
    );
    return res.status(CSRF_REJECT_STATUS).json({ error: CSRF_REJECT_MESSAGE, code: CSRF_INVALID_CODE });
  }
  return next();
}
