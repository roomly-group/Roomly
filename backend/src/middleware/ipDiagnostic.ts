import type { NextFunction, Request, Response } from "express";
import { API_BASE_PATH, API_ROUTE_PATHS } from "@workspace/api-zod";
import { logger } from "../lib/logger.js";

// TEMPORARY (RMY-01, round 2): shows how Vercel handles IP headers that the
// VISITOR sends (overwritten, appended, or passed through). Only requests that
// carry the test marker header are logged, so real visitors are never logged.
// Delete this file and its app.use() in app.ts once the logs have been read.

// ===================== CONFIGURATION =====================

/** Only requests to this path are logged. */
const IP_DIAGNOSTIC_PATH = `${API_BASE_PATH}${API_ROUTE_PATHS.VERIFY}`;
/** Marker header sent only by the test script. */
const IP_DIAGNOSTIC_MARKER_HEADER = "x-roomly-diag" as const;
/** Stop logging after this many requests per server start. */
const IP_DIAGNOSTIC_MAX_LOGS = 40 as const;
/** Headers that may carry the visitor IP. Only these values are logged, masked. */
const IP_DIAGNOSTIC_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "x-vercel-forwarded-for",
  "x-vercel-proxied-for",
  "forwarded",
] as const;
/** IPv4: keep the first two numbers (79.15.x.x). IPv6: keep the first two groups. */
const IPV4_PATTERN = /\b(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}\b/g;
const IPV6_PATTERN = /\b([0-9a-f]{1,4}):([0-9a-f]{1,4})(?::[0-9a-f]{0,4}){2,7}/gi;

let loggedCount = 0;

/** Masks every IP inside a header value so full addresses never reach the logs. */
const maskIps = (value: string): string =>
  value.replace(IPV4_PATTERN, "$1.$2.x.x").replace(IPV6_PATTERN, "$1:$2:x");

export function logIpHeaders(req: Request, _res: Response, next: NextFunction) {
  const marker = req.headers[IP_DIAGNOSTIC_MARKER_HEADER];
  if (typeof marker === "string" && loggedCount < IP_DIAGNOSTIC_MAX_LOGS && req.path === IP_DIAGNOSTIC_PATH) {
    loggedCount++;
    const ipHeaders: Record<string, string> = {};
    for (const name of IP_DIAGNOSTIC_HEADERS) {
      const value = req.headers[name];
      if (typeof value === "string") ipHeaders[name] = maskIps(value);
    }
    // marker = which fake header the test sent on this request (e.g. "vff-1").
    logger.warn({ ipDiagnostic: { marker: marker.slice(0, 20), ipHeaders } }, "RMY-01 ip diagnostic 2");
  }
  next();
}
