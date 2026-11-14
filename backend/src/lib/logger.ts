import { createHash } from "node:crypto";
import pino from "pino";

// ===================== CONFIGURATION =====================

const isProduction = process.env.NODE_ENV === "production";

/** Hex characters kept from the email SHA-256: enough to group log lines by account, not to read the address. */
const EMAIL_HASH_LENGTH = 12 as const;
/** Anything that looks like an email address inside a logged message. */
const EMAIL_PATTERN = /[^\s@"'<>(),;:]+@[^\s@"'<>(),;:]+\.[^\s@"'<>(),;:]+/g;
/** What an email address found in a logged message is replaced with. */
const EMAIL_MASK = "[email]" as const;
/** Longest error message / stack written to the logs (characters). */
const MAX_LOGGED_TEXT_LENGTH = 2000 as const;

/**
 * Fields pino replaces with "[Redacted]" wherever they appear at the top level
 * or one level down (RMY-10). A safety net: the code should not log these at
 * all, but if someone passes a whole object by mistake, they still never land
 * in the Railway logs. `details` and `hint` are the Postgres error fields that
 * can carry row values (for example "Key (email)=(...) already exists").
 */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  ...["email", "password", "access_token", "refresh_token", "details", "hint"].flatMap((key) => [key, `*.${key}`]),
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: REDACT_PATHS,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});

/** Replaces every email address in a text with EMAIL_MASK and caps its length. */
function maskText(text: string): string {
  return text.replace(EMAIL_PATTERN, EMAIL_MASK).slice(0, MAX_LOGGED_TEXT_LENGTH);
}

/**
 * Short, one-way hash of an email for logs (RMY-10): the same address always
 * gives the same value, so failed logins can still be grouped by account
 * during a support case, but the address itself is never stored.
 * Accepts any value (request bodies are untrusted) so logging never throws.
 */
export function hashEmail(email: unknown): string {
  return createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex").slice(0, EMAIL_HASH_LENGTH);
}

/** The only parts of an error that are written to the logs. */
export type LoggedError = {
  name?: string;
  code?: string | number;
  status?: number;
  message?: string;
  stack?: string;
};

/**
 * Turns any thrown value or Supabase error into a log-safe object (RMY-10).
 * Keeps only name, code, status, message and stack, with emails masked.
 * Everything else is dropped on purpose: Supabase/Postgres errors carry
 * `details` and `hint`, which can contain row values (emails, names, ...).
 * Use it as `logger.error({ error: errorForLog(err) }, "What failed")`.
 */
export function errorForLog(err: unknown): LoggedError | undefined {
  if (err === null || err === undefined) return undefined;
  if (typeof err !== "object") return { message: maskText(String(err)) };

  const source = err as Record<string, unknown>;
  const logged: LoggedError = {};
  if (err instanceof Error && err.name !== "Error") logged.name = err.name;
  if (typeof source.code === "string" || typeof source.code === "number") logged.code = source.code;
  if (typeof source.status === "number") logged.status = source.status;
  if (typeof source.message === "string") logged.message = maskText(source.message);
  // Stack traces only for real crashes (no code from Supabase), to find the bug.
  if (err instanceof Error && logged.code === undefined && typeof err.stack === "string") {
    logged.stack = maskText(err.stack);
  }
  return logged;
}
