// PKCE for every Supabase Auth flow that sends the user away and back
// (Google login, the signup confirmation email, the email-change link).
//
// Why it lives on the server: with the old implicit flow Supabase sent the
// user back with `#access_token=…&refresh_token=…` in the URL, so the tokens
// passed through page JavaScript and browser history. With PKCE, Supabase
// sends back only a one-time `?code=`. That code is useless without the
// secret "code verifier", which we keep in an HttpOnly cookie, and only the
// backend trades code + verifier for a session (then stored as HttpOnly cookies).
//
// We call Supabase Auth's REST API directly instead of supabase-js's PKCE
// helpers: those keep the verifier in the client's own storage (internal,
// versioned slot keys) and append their own parameter to the redirect URL,
// neither of which fits a verifier we keep in our own cookie.

import crypto from "crypto";

// ===================== CONFIGURATION =====================

/** Random bytes behind each code verifier: 32 bytes give 43 base64url characters (RFC 7636 minimum). */
const PKCE_VERIFIER_RANDOM_BYTES = 32 as const;
/** Challenge method name Supabase Auth expects for a SHA-256 challenge. */
const PKCE_CHALLENGE_METHOD = "s256" as const;
/** Path of Supabase Auth's REST API on the project URL. */
const AUTH_API_PATH = "/auth/v1" as const;
/** Shape of a verifier we created (RFC 7636 unreserved characters, 43-128 long). */
const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
/** Shape of an auth code coming back from Supabase (a UUID today; kept loose but bounded). */
const AUTH_CODE_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

const supabaseUrl = process.env["SUPABASE_URL"];
const anonKey = process.env["SUPABASE_ANON_KEY"];

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL environment variable is required but was not provided.");
}
if (!anonKey) {
  throw new Error("SUPABASE_ANON_KEY environment variable is required but was not provided.");
}

// ===================== TYPES =====================

export type AuthUser = {
  id: string;
  email?: string | null;
  /** Address waiting for confirmation after an email change. */
  new_email?: string | null;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  /** Epoch seconds. */
  expires_at?: number;
  /** Seconds from now. */
  expires_in?: number;
  user: AuthUser;
};

export type AuthApiError = {
  /** HTTP status from Supabase, or 0 when Supabase could not be reached. */
  status: number;
  /** Supabase's machine-readable error code (e.g. "captcha_failed"), when it sent one. */
  code: string | null;
  /** Supabase's own message: for server logs, never shown to users as-is. */
  message: string;
};

type AuthResult<T> = { data: T; error: null } | { data: null; error: AuthApiError };

// ===================== HELPERS =====================

/** A fresh verifier (kept secret, in our cookie) and its challenge (sent to Supabase). */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(PKCE_VERIFIER_RANDOM_BYTES).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function isValidPkceVerifier(value: unknown): value is string {
  return typeof value === "string" && PKCE_VERIFIER_PATTERN.test(value);
}

export function isValidAuthCode(value: unknown): value is string {
  return typeof value === "string" && AUTH_CODE_PATTERN.test(value);
}

/** Epoch seconds at which a session's access token expires. */
export function sessionExpiresAt(session: AuthSession): number | undefined {
  if (typeof session.expires_at === "number") return session.expires_at;
  if (typeof session.expires_in === "number") return Math.floor(Date.now() / 1000) + session.expires_in;
  return undefined;
}

// Supabase answers errors as { error_code, msg } (or { code, message } on
// newer API versions, or { error, error_description } on older endpoints).
function toAuthError(status: number, payload: Record<string, unknown>): AuthApiError {
  const code = [payload["error_code"], payload["code"], payload["error"]].find((value) => typeof value === "string");
  const message = [payload["msg"], payload["message"], payload["error_description"], payload["error"]].find(
    (value) => typeof value === "string",
  );
  return { status, code: (code as string | undefined) ?? null, message: (message as string | undefined) ?? `HTTP ${status}` };
}

async function authRequest<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  options: { query?: Record<string, string | undefined>; body?: unknown; accessToken?: string } = {},
): Promise<AuthResult<T>> {
  const url = new URL(`${supabaseUrl}${AUTH_API_PATH}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        apikey: anonKey!,
        // A user's own access token for user-scoped calls (PUT /user), the anon key otherwise.
        Authorization: `Bearer ${options.accessToken ?? anonKey}`,
        "Content-Type": "application/json",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) return { data: null, error: toAuthError(response.status, payload) };
    return { data: payload as T, error: null };
  } catch (error) {
    return { data: null, error: { status: 0, code: null, message: error instanceof Error ? error.message : "Network error" } };
  }
}

// ===================== FLOWS =====================

/** URL that starts an OAuth login (e.g. Google) and comes back to `redirectTo` with `?code=`. */
export function oauthAuthorizeUrl(provider: string, redirectTo: string, challenge: string): string {
  const url = new URL(`${supabaseUrl}${AUTH_API_PATH}/authorize`);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_to", redirectTo);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", PKCE_CHALLENGE_METHOD);
  return url.toString();
}

/**
 * Creates an account. When email confirmation is on, Supabase answers with the
 * user only, and the link in the email comes back with `?code=`. When it is
 * off, Supabase answers with a session straight away.
 */
export function signUpWithPkce(params: {
  email: string;
  password: string;
  captchaToken: string;
  redirectTo?: string;
  challenge: string;
}): Promise<AuthResult<AuthSession | AuthUser>> {
  return authRequest<AuthSession | AuthUser>("POST", "/signup", {
    query: { redirect_to: params.redirectTo },
    body: {
      email: params.email,
      password: params.password,
      data: {},
      gotrue_meta_security: { captcha_token: params.captchaToken },
      code_challenge: params.challenge,
      code_challenge_method: PKCE_CHALLENGE_METHOD,
    },
  });
}

/**
 * Starts an email change for the user owning `accessToken`. The confirmation
 * link comes back to the site with `?code=`. Returns the updated user: its
 * `email` is already the new one only when Supabase needs no confirmation.
 */
export function requestEmailChange(accessToken: string, email: string, challenge: string): Promise<AuthResult<AuthUser>> {
  return authRequest<AuthUser>("PUT", "/user", {
    accessToken,
    body: { email, code_challenge: challenge, code_challenge_method: PKCE_CHALLENGE_METHOD },
  });
}

/** Trades the one-time `code` from the redirect, plus our stored verifier, for a session. */
export function exchangeAuthCode(code: string, verifier: string): Promise<AuthResult<AuthSession>> {
  return authRequest<AuthSession>("POST", "/token", {
    query: { grant_type: "pkce" },
    body: { auth_code: code, code_verifier: verifier },
  });
}

/** True when Supabase's answer is a session (signup with email confirmation off). */
export function isAuthSession(value: AuthSession | AuthUser): value is AuthSession {
  return typeof (value as AuthSession).access_token === "string" && typeof (value as AuthSession).refresh_token === "string";
}
