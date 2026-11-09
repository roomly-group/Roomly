import crypto from "crypto";
import { isIP } from "net";
import type { NextFunction, Request, Response } from "express";
import { API_BASE_PATH, API_ROUTE_PATHS } from "@workspace/api-zod";
import { logger } from "../lib/logger.js";

// ===================== CONFIGURATION =====================

/** Request header Vercel adds to every /api request it forwards here (see frontend/vercel.json). */
const ORIGIN_SECRET_HEADER = "x-roomly-origin-secret" as const;
/** Environment variable holding the shared secret. Same name and value on Vercel and Railway. */
const ORIGIN_SECRET_ENV_NAME = "ORIGIN_SECRET" as const;
/** Paths that skip the check: Railway's health check calls the service directly. */
const ORIGIN_SECRET_EXEMPT_PATHS: readonly string[] = [`${API_BASE_PATH}${API_ROUTE_PATHS.HEALTH}`];
/** Status and message for requests that did not come through Vercel. */
const ORIGIN_SECRET_REJECT_STATUS = 403 as const;
const ORIGIN_SECRET_REJECT_MESSAGE = "Forbidden" as const;
/**
 * Header where Vercel writes the real visitor IP when it forwards a request.
 * Measured in production (Nov 2026), sending fake values through the site:
 * - x-vercel-proxied-for: always the real visitor IP (fake values replaced 28/28).
 * - x-vercel-forwarded-for: NOT safe, a fake value got through 8 times out of 18.
 * - X-Forwarded-For: only Vercel's and Railway's own IPs, never the visitor.
 */
const VERCEL_CLIENT_IP_HEADER = "x-vercel-proxied-for" as const;

// Only log the "secret missing" warning once, not on every request.
let missingSecretWarned = false;

// Requests whose secret matched, i.e. that really came through Vercel.
// A WeakSet so entries disappear with the request object.
const requestsFromVercel = new WeakSet<Request>();

/** SHA-256 digest, so timingSafeEqual always compares two values of equal length. */
const digest = (value: string): Buffer => crypto.createHash("sha256").update(value).digest();

/**
 * Blocks requests that reach the Railway URL directly instead of going through
 * Vercel. Vercel sets the secret header on every /api request it rewrites to
 * Railway (replacing any value the visitor sent), so only Vercel knows it.
 *
 * Why it matters: the rate limiters key on the visitor IP from Vercel's header
 * (see getClientIp), which is only trustworthy when the request really passed
 * through Vercel. A direct call could fake that header and dodge every limit.
 *
 * Only enforced in production (local dev goes through the Vite proxy, which
 * does not add the header). If ORIGIN_SECRET is not set in production the
 * request is let through and a warning is logged once (fail open, by choice).
 */
export function requireOriginSecret(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production" || ORIGIN_SECRET_EXEMPT_PATHS.includes(req.path)) {
    return next();
  }

  const expectedSecret = process.env[ORIGIN_SECRET_ENV_NAME];
  if (!expectedSecret) {
    if (!missingSecretWarned) {
      missingSecretWarned = true;
      logger.warn(
        `${ORIGIN_SECRET_ENV_NAME} is not set: direct requests to the backend are NOT blocked and rate limits cannot tell visitors apart.`,
      );
    }
    return next();
  }

  const receivedSecret = req.headers[ORIGIN_SECRET_HEADER];
  // Constant-time comparison so the secret cannot be guessed byte by byte from response timings.
  if (typeof receivedSecret === "string" && crypto.timingSafeEqual(digest(receivedSecret), digest(expectedSecret))) {
    requestsFromVercel.add(req);
    return next();
  }

  return res.status(ORIGIN_SECRET_REJECT_STATUS).json({ error: ORIGIN_SECRET_REJECT_MESSAGE });
}

/**
 * The visitor IP used by the rate limiters.
 * - Request verified as coming from Vercel: the IP Vercel wrote in its own
 *   header (the visitor cannot set it, Vercel replaces it).
 * - Otherwise (local dev, or ORIGIN_SECRET missing): req.ip, i.e. whoever
 *   connected to Railway (see TRUST_PROXY_HOPS in app.ts), which cannot be faked.
 */
export function getClientIp(req: Request): string {
  const vercelClientIp = req.headers[VERCEL_CLIENT_IP_HEADER];
  if (requestsFromVercel.has(req) && typeof vercelClientIp === "string") {
    const firstIp = vercelClientIp.split(",")[0]?.trim() ?? "";
    if (isIP(firstIp)) return firstIp;
  }
  return req.ip || req.socket.remoteAddress || "";
}
