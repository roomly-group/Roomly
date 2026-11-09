import type { NextFunction, Request, Response } from "express";
import { API_BASE_PATH, API_ROUTE_PATHS } from "@workspace/api-zod";
import { logger } from "../lib/logger.js";

// TEMPORARY (RMY-01): finds out which header carries the real visitor IP
// after Vercel → Railway. Delete this file and its app.use() in app.ts once
// the logs have been read.

// ===================== CONFIGURATION =====================

/** Only requests to this path are logged. */
const IP_DIAGNOSTIC_PATH = `${API_BASE_PATH}${API_ROUTE_PATHS.VERIFY}`;
/** Stop logging after this many requests per server start, to keep logs (and personal data) minimal. */
const IP_DIAGNOSTIC_MAX_LOGS = 30 as const;
/** Headers that may carry the visitor IP. Only these values are logged, masked. */
const IP_DIAGNOSTIC_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "x-vercel-forwarded-for",
  "x-vercel-proxied-for",
  "x-vercel-ip",
  "forwarded",
  "true-client-ip",
  "cf-connecting-ip",
  "x-client-ip",
  "x-envoy-external-address",
] as const;
/** IPv4: keep the first two numbers (79.15.x.x). IPv6: keep the first two groups. */
const IPV4_PATTERN = /\b(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}\b/g;
const IPV6_PATTERN = /\b([0-9a-f]{1,4}):([0-9a-f]{1,4})(?::[0-9a-f]{0,4}){2,7}/gi;

let loggedCount = 0;

/** Masks every IP inside a header value so full addresses never reach the logs. */
const maskIps = (value: string): string =>
  value.replace(IPV4_PATTERN, "$1.$2.x.x").replace(IPV6_PATTERN, "$1:$2:x");

export function logIpHeaders(req: Request, _res: Response, next: NextFunction) {
  if (loggedCount < IP_DIAGNOSTIC_MAX_LOGS && req.path === IP_DIAGNOSTIC_PATH) {
    loggedCount++;
    const ipHeaders: Record<string, string> = {};
    for (const name of IP_DIAGNOSTIC_HEADERS) {
      const value = req.headers[name];
      if (typeof value === "string") ipHeaders[name] = maskIps(value);
    }
    logger.warn(
      {
        ipDiagnostic: {
          n: loggedCount,
          socket: maskIps(req.socket.remoteAddress ?? ""),
          reqIp: maskIps(req.ip ?? ""),
          ipHeaders,
          // Header NAMES only (no values): shows what else Vercel/Railway add.
          headerNames: Object.keys(req.headers).filter((name) => name.startsWith("x-")),
        },
      },
      "RMY-01 ip diagnostic",
    );
  }
  next();
}
