import type { NextFunction, Request, Response } from "express";
import { errorForLog, logger } from "../lib/logger.js";

// ===================== CONFIGURATION =====================

/** Range of statuses that are the client's fault and can be passed on as they are. */
const CLIENT_ERROR_MIN_STATUS = 400 as const;
const CLIENT_ERROR_MAX_STATUS = 499 as const;
/** Status used for every other (unexpected) error. */
const SERVER_ERROR_STATUS = 500 as const;
/**
 * Short, generic messages sent back to the browser. Never the real error
 * message or stack trace: those can reveal internals (RMY-20). The pages
 * already turn a failed request into a friendly, translated text.
 */
const ERROR_MESSAGES: Readonly<Record<number, string>> = {
  400: "Invalid request",
  403: "Forbidden",
  404: "Not found",
  413: "Request too large",
  415: "Unsupported content type",
  [SERVER_ERROR_STATUS]: "Internal server error",
};
/** Fallback message for a client error status not listed above. */
const DEFAULT_CLIENT_ERROR_MESSAGE = "Invalid request" as const;

/**
 * An error that carries the HTTP status to answer with, e.g. a request from an
 * origin that CORS does not allow (403, see app.ts).
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** The 4xx status an error asks for (body-parser sets `status` on bad JSON or too-large bodies), else 500. */
function statusOf(err: unknown): number {
  const source = (err ?? {}) as { status?: unknown; statusCode?: unknown };
  const status = typeof source.status === "number" ? source.status : source.statusCode;
  return typeof status === "number" && status >= CLIENT_ERROR_MIN_STATUS && status <= CLIENT_ERROR_MAX_STATUS
    ? status
    : SERVER_ERROR_STATUS;
}

/**
 * Last middleware of the app (RMY-20). Without it, Express answered errors
 * with its own HTML page (and the stack trace outside production). Now every
 * error becomes a short JSON body, and the real cause goes to the server log only.
 * Express recognises it as an error handler because it takes 4 arguments.
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  // The answer was already partly sent: let Express close the connection.
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = statusOf(err);
  const logFields = { error: errorForLog(err), method: req.method, path: req.path, status };
  if (status === SERVER_ERROR_STATUS) {
    logger.error(logFields, "Unhandled request error");
  } else {
    logger.warn(logFields, "Request rejected");
  }

  res.status(status).json({ error: ERROR_MESSAGES[status] ?? DEFAULT_CLIENT_ERROR_MESSAGE });
}
