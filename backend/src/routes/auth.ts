import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { createRequestAuthClient, supabaseAuthClient } from "../lib/supabase-auth.js";
import { loginEmailLimiter, loginLimiter, oauthLimiter, refreshLimiter, signupLimiter, verifyLimiter } from "../middleware/rateLimit.js";
import { sendAccountSuspended } from "../middleware/auth.js";
import { errorForLog, hashEmail, logger } from "../lib/logger.js";
import { isAllowedOrigin } from "../lib/origins.js";
import {
  createPkcePair,
  exchangeAuthCode,
  isAuthSession,
  isValidAuthCode,
  isValidPkceVerifier,
  oauthAuthorizeUrl,
  sessionExpiresAt,
  signUpWithPkce,
  type AuthSession,
} from "../lib/supabase-pkce.js";
import { API_BASE_PATH, API_ROUTE_PATHS, CSRF_TOKEN_COOKIE_NAME } from "@workspace/api-zod";

import crypto from 'crypto';

// ===================== CONFIGURATION =====================

/** Cookie key carrying the authenticated access token (exported for DELETE /api/me). */
export const ACCESS_TOKEN_COOKIE_NAME = 'sb-token' as const;
/** Cookie key carrying the refresh token. */
const REFRESH_TOKEN_COOKIE_NAME = 'sb-refresh-token' as const;
/** Path scope shared by authentication and CSRF cookies. */
const AUTH_COOKIE_PATH = '/' as const;
/** Access-token cookie lifetime (seconds). */
const ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS = 604800 as const;
/** Refresh-token cookie lifetime (seconds). */
const REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS = 2592000 as const;
/** Random byte length used to create CSRF cookie values (bytes). */
const CSRF_TOKEN_RANDOM_BYTES = 32 as const;
/** Frontend page the signup confirmation email links to (mirrors APP_ROUTES.ONBOARDING). */
const ONBOARDING_APP_PATH = '/onboarding' as const;
/** Supabase auth error code returned when the Turnstile CAPTCHA token is invalid/expired/reused. */
const SUPABASE_CAPTCHA_FAILED_CODE = 'captcha_failed' as const;
/** Supabase auth error code for a banned user (set when utenti.stato is not 'attivo', migration 017). */
const SUPABASE_USER_BANNED_CODE = 'user_banned' as const;
/** Friendly message shown when the CAPTCHA (security check) is missing or expired. */
const CAPTCHA_ERROR_MESSAGE = 'Verifica di sicurezza mancante o scaduta' as const;
/** Cookie holding the secret PKCE code verifier between leaving the site and coming back. */
const PKCE_VERIFIER_COOKIE_NAME = 'sb-pkce-verifier' as const;
/** The verifier cookie is sent only to the code-exchange route, nowhere else. */
const PKCE_VERIFIER_COOKIE_PATH = `${API_BASE_PATH}${API_ROUTE_PATHS.OAUTH_EXCHANGE}` as const;
/** Verifier lifetime for Google login: the round trip to Google takes minutes at most (seconds). */
export const OAUTH_VERIFIER_MAX_AGE_SECONDS = 600 as const;
/** Verifier lifetime for email links (signup, email change): Supabase links last up to 24 h (seconds). */
export const EMAIL_LINK_VERIFIER_MAX_AGE_SECONDS = 86400 as const;
/** OAuth provider behind the "Continue with Google" button. */
const GOOGLE_PROVIDER = 'google' as const;

const router: IRouter = Router();

const isProd = process.env.NODE_ENV === "production";

// Express's res.cookie() takes `maxAge` in MILLISECONDS. Passing the *_SECONDS
// constants directly made the session cookies expire ~1000x too early
// (access ≈ 10 min, refresh ≈ 43 min, the one set at login ≈ 3.6 s).
const secondsToMs = (seconds: number) => seconds * 1000;

// Remaining lifetime of a Supabase session (`expires_at` is in epoch seconds), in ms.
const msUntil = (expiresAtSeconds: number) => Math.max(0, expiresAtSeconds * 1000 - Date.now());

// Helper to set the access-token cookie
function setAuthCookie(res: Response, token: string, options: { httpOnly?: boolean; secure?: boolean; sameSite?: 'strict' | 'lax' | 'none'; maxAge?: number } = {}) {
  const defaults = {
    httpOnly: true,
    secure: isProd, // true in production, false in dev
    sameSite: 'lax' as const,
    maxAge: secondsToMs(ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS), // 1 week
    path: AUTH_COOKIE_PATH,
  };
  const opts = { ...defaults, ...options };
  res.cookie(ACCESS_TOKEN_COOKIE_NAME, token, opts);
}

// Helper to set the refresh-token cookie. Without this, the frontend never
// receives a refresh_token from the backend, so supabase.auth.setSession()
// (which requires BOTH tokens) silently fails after every reload — no
// exception is thrown, the client just ends up with no session, which broke
// email display and access to /profile.
function setRefreshCookie(res: Response, refreshToken: string, options: { maxAge?: number } = {}) {
  const defaults = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    maxAge: secondsToMs(REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS), // refresh tokens live longer than access tokens
    path: AUTH_COOKIE_PATH,
  };
  const opts = { ...defaults, ...options };
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, opts);
}

// Exported for DELETE /api/me (routes/me.ts), which logs the user out after deleting the account.
export function clearAuthCookies(res: Response) {
  const base = { path: AUTH_COOKIE_PATH, httpOnly: true, secure: isProd, sameSite: 'lax' as const };
  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, base);
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, base);
}

// Helper to set the CSRF token cookie (not HttpOnly, so frontend can read it)
// SameSite=Strict to prevent sending in cross-site requests
function setCsrfCookie(res: Response, token: string, options: { maxAge?: number } = {}) {
  const defaults = {
    httpOnly: false, // Frontend needs to read this cookie
    secure: isProd,
    sameSite: 'strict' as const,
    maxAge: secondsToMs(ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS), // 1 week, same as access token
    path: AUTH_COOKIE_PATH,
  };
  const opts = { ...defaults, ...options };
  res.cookie(CSRF_TOKEN_COOKIE_NAME, token, opts);
}

// Stores the PKCE code verifier until the user comes back with `?code=`.
// HttpOnly (page scripts can never read it), SameSite=Strict and scoped to the
// exchange route only. Exported for the email change (routes/me.ts).
export function setPkceVerifierCookie(res: Response, verifier: string, maxAgeSeconds: number) {
  res.cookie(PKCE_VERIFIER_COOKIE_NAME, verifier, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: secondsToMs(maxAgeSeconds),
    path: PKCE_VERIFIER_COOKIE_PATH,
  });
}

function clearPkceVerifierCookie(res: Response) {
  res.clearCookie(PKCE_VERIFIER_COOKIE_NAME, { httpOnly: true, secure: isProd, sameSite: 'strict', path: PKCE_VERIFIER_COOKIE_PATH });
}

// Turns a fresh Supabase session into our cookies: access + refresh tokens
// (HttpOnly) and a new CSRF token. The tokens never go into a response body.
function setSessionCookies(res: Response, session: Pick<AuthSession, 'access_token' | 'refresh_token'>, expiresAtSeconds: number | undefined) {
  setAuthCookie(res, session.access_token, expiresAtSeconds ? { maxAge: msUntil(expiresAtSeconds) } : {});
  setRefreshCookie(res, session.refresh_token);
  setCsrfCookie(res, crypto.randomBytes(CSRF_TOKEN_RANDOM_BYTES).toString('hex'));
}

// What the frontend gets to know about a session: who is logged in and when
// the access token expires (to schedule the next refresh). No tokens: page
// JavaScript (and so any XSS) must never be able to read them.
function sessionBody(user: { id: string; email?: string | null }, expiresAtSeconds: number | undefined) {
  return {
    session: {
      expires_at: expiresAtSeconds ? expiresAtSeconds * 1000 : undefined, // seconds -> milliseconds
      user: { id: user.id, email: user.email ?? null },
    },
  };
}

// Site address to come back to after Google or an email link, built only from
// a known frontend origin (never from free user input).
function returnUrl(req: Request, path: string): string | undefined {
  const origin = req.header('origin');
  return isAllowedOrigin(origin) ? `${origin}${path}` : undefined;
}

// Login endpoint
// loginLimiter: per IP+email. loginEmailLimiter: per email from any IP,
// counting only wrong passwords (401), see middleware/rateLimit.ts.
router.post(API_ROUTE_PATHS.LOGIN, loginLimiter, loginEmailLimiter, async (req: Request, res: Response) => {
const { password, captchaToken } = req.body as { password?: string; captchaToken?: string };
  // Trim/lowercase defensively: a leading/trailing space from copy-paste or
  // browser autofill makes Supabase treat it as a different address (or, for
  // password, a different credential), producing the same generic "Invalid
  // email or password" as an actually wrong password - with no way to tell
  // the two apart from the outside.
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : req.body?.email;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Same backstop as /register: the Turnstile token produced by the widget
  // on the login page, forwarded here and on to Supabase, which verifies it
  // server-side against the Turnstile secret key (Authentication -> Attack
  // Protection) and rejects signInWithPassword() if it's missing/invalid/
  // reused. Without this, login had no CAPTCHA at all - only signup did -
  // leaving credential-stuffing / brute-force scripts free to hit this
  // route (or Supabase directly with the anon key) unchecked by anything
  // but the rate limiter.
  if (!captchaToken) {
    return res.status(400).json({ error: CAPTCHA_ERROR_MESSAGE });
  }

  try {
    // IMPORTANT: use supabaseAuthClient (anon key), never supabaseAdmin, here.
    // signInWithPassword() sets a live session on whichever client instance
    // calls it — doing that on supabaseAdmin (shared, service-role, used to
    // bypass RLS everywhere else) would silently switch it to run as this
    // user for every later query, server-wide, until the next login.
    const { data: authData, error: authError } = await supabaseAuthClient.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });

    if (authError || !authData.session) {
      const authErrorCode = (authError as { code?: string } | null)?.code;
      // Log the REAL reason server-side only. Supabase distinguishes wrong
      // password / user not found / email not confirmed / etc, but we still
      // return one generic message to the client on purpose (so a failed
      // login never reveals whether an account exists). Without this log,
      // "email not confirmed" and "wrong password" were indistinguishable
      // from the outside, including to us when debugging a support report.
      // The email is hashed (RMY-10): support can hash the address a user
      // gives them and find the matching lines, but the logs hold no addresses.
      logger.warn(
        { emailHash: hashEmail(email), authErrorCode, error: errorForLog(authError) },
        'Login failed',
      );
      // Bad CAPTCHA: Supabase never checked the password. Answer 400 (not 401)
      // so it does not count toward the per-email limit: otherwise anyone
      // could lock a user out by sending fake CAPTCHA tokens with their email.
      if (authErrorCode === SUPABASE_CAPTCHA_FAILED_CODE) {
        return res.status(400).json({ error: CAPTCHA_ERROR_MESSAGE });
      }
      // Suspended account (RMY-04): tell the user plainly instead of "wrong
      // password". Supabase already returns "user_banned" to anyone calling
      // its public login endpoint, so this reveals nothing new. 403 (not 401)
      // keeps it out of the per-email wrong-password limit.
      if (authErrorCode === SUPABASE_USER_BANNED_CODE) {
        sendAccountSuspended(res);
        return;
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { access_token, refresh_token, user, expires_at } = authData.session;

    // Set HTTP-only cookies with the access token and refresh token
    setAuthCookie(res, access_token,
      expires_at ? { maxAge: msUntil(expires_at) } : {}
    );
    setRefreshCookie(res, refresh_token);
    // Set CSRF token cookie
    const csrfToken = crypto.randomBytes(CSRF_TOKEN_RANDOM_BYTES).toString('hex');
    setCsrfCookie(res, csrfToken);

    // Return session data for frontend to set Supabase client session
    // Note: This is only used temporarily to set supabase.auth.setSession()
    // and is not stored persistently by frontend code
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        // Return other non-sensitive user fields as needed
      }
    });
  } catch (error) {
    logger.error({ error: errorForLog(error) }, 'Login error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Uses the refresh-token cookie to get a fresh session from Supabase and
// stores it in new cookies. The frontend calls it shortly before the access
// token expires (lib/auth-session.ts). Tokens never travel in the request or
// the response body: the browser only learns who is logged in and the new expiry.
// Returns null (and clears the cookies) when the refresh token is no longer valid.
async function refreshFromCookie(res: Response, refreshToken: string) {
  const { data, error } = await createRequestAuthClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) {
    clearAuthCookies(res);
    return null;
  }
  const expiresAt = data.session.expires_at;
  setSessionCookies(res, data.session, expiresAt);
  return sessionBody(data.user, expiresAt);
}

router.post(API_ROUTE_PATHS.REFRESH, refreshLimiter, async (req: Request, res: Response) => {
  // CSRF protection: require custom header to prevent cross-site requests
  const csrfTokenCookie = req.cookies?.[CSRF_TOKEN_COOKIE_NAME];
  const csrfTokenHeader = req.headers['x-csrf-token'];
  if (!csrfTokenCookie || !csrfTokenHeader || csrfTokenCookie !== csrfTokenHeader) {
    return res.status(403).json({ error: 'CSRF token missing or invalid' });
  }

  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh cookie' });
  }

  try {
    const body = await refreshFromCookie(res, refreshToken);
    if (!body) return res.status(401).json({ error: 'Invalid or expired token' });
    return res.json(body);
  } catch (error) {
    logger.error({ error: errorForLog(error) }, 'Refresh error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify endpoint - checks if the session cookies are valid and tells the
// frontend who is logged in. Returns the user and expiry only, never the tokens.
router.post(API_ROUTE_PATHS.VERIFY, verifyLimiter, async (req: Request, res: Response) => {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE_NAME];
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

  if (!token && !refreshToken) {
    return res.status(401).json({ error: 'No token cookie' });
  }

  try {
    // Validate the token with Supabase admin (only gets user data)
    const { data: userData, error: userError } = token
      ? await supabaseAdmin.auth.getUser(token)
      : { data: null, error: null };

    // Access token missing or expired (e.g. the tab was closed for more than an
    // hour): mint a new session from the refresh cookie instead of logging the
    // user out while their refresh token is still valid.
    if (!token || userError || !userData || typeof userData !== 'object' || !userData.user) {
      if (!refreshToken) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      const body = await refreshFromCookie(res, refreshToken);
      if (!body) return res.status(401).json({ error: 'Invalid or expired token' });
      return res.json(body);
    }

    // Decode JWT token to get expiration time
    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) {
        throw new Error('Invalid token format');
      }
      // Replace URL-safe characters and add padding if needed
      const payload = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding to make length multiple of 4
      const paddedPayload = payload.length % 4 === 0 ? payload : payload + '='.repeat(4 - (payload.length % 4));
      const decodedPayload = Buffer.from(paddedPayload, 'base64').toString('utf-8');
      const payloadJson = JSON.parse(decodedPayload);
      const exp = payloadJson.exp;

      if (typeof exp !== 'number') {
        throw new Error('Invalid or missing expiration time in token');
      }

      return res.json(sessionBody(userData.user, exp));
    } catch (decodeError) {
      logger.error({ error: errorForLog(decodeError) }, 'JWT decode error');
      // Treat decoding failures as invalid tokens
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    logger.error({ error: errorForLog(error) }, 'Verify error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
router.post(API_ROUTE_PATHS.LOGOUT, async (req: Request, res: Response) => {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE_NAME];
  if (token) {
    try {
      // Revoke only the caller's session, identified by their own access token.
      // Never call signOut() on supabaseAuthClient: it is shared by the whole
      // process and holds whichever user logged in last, so it signed out
      // somebody else instead of the caller.
      const { error } = await supabaseAdmin.auth.admin.signOut(token, 'local');
      if (error) logger.error({ error: errorForLog(error) }, 'Error during signOut');
    } catch (error) {
      // Log the error but continue with cookie clearance
      // We still want to clear cookies even if signOut fails
      logger.error({ error: errorForLog(error) }, 'Error during signOut');
    }
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

// Config endpoint - lets frontend know if email confirmation is required
router.get(API_ROUTE_PATHS.AUTH_CONFIG, (_req: Request, res: Response) => {
  res.json({ requireEmailConfirmation: true });
});

// Register endpoint - proxies to Supabase Auth's signUp() from the server
// instead of letting the frontend call supabase.auth.signUp() directly.
//
// This route alone does NOT fully close off scripted mass sign-ups.
// Supabase's /auth/v1/signup REST endpoint is public infrastructure and
// accepts the same publishable/anon key the frontend ships to every
// browser - that key is not a secret, so anyone can still call Supabase
// directly, bypassing this route (and this rate limiter) entirely. This
// endpoint's job is to make the *normal* signup path go through our own
// rate limiting and logging.
//
// The actual backstop against someone hitting Supabase directly is the
// `captchaToken`: it's a Cloudflare Turnstile response token produced by
// the widget on the register page, forwarded here and then on to Supabase.
// Supabase verifies it server-side against the Turnstile secret key
// configured in the dashboard (Authentication -> Attack Protection) and
// rejects the signUp() call if it's missing/invalid/reused - regardless of
// whether the call came through this route or hit Supabase directly with
// the anon key, like a script such as test.py does. Requires "Enable
// Captcha protection" to actually be turned on in Supabase; see chat.
//
// Signup asks only for email and password: name, date of birth and the rest
// are collected right after, by the onboarding (/onboarding, routes/onboarding.ts).
router.post(API_ROUTE_PATHS.REGISTER, signupLimiter, async (req: Request, res: Response) => {
  const { password, captchaToken } = req.body as {
    email?: string;
    password?: string;
    captchaToken?: string;
  };
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : req.body?.email;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password sono obbligatorie' });
  }

  if (!captchaToken) {
    return res.status(400).json({ error: 'Verifica di sicurezza mancante o scaduta' });
  }

  // The confirmation link brings the user straight into the onboarding. Supabase
  // only honours this URL if it is listed under Authentication → URL
  // Configuration → Redirect URLs; otherwise it falls back to the Site URL.
  // Either way the link comes back with `?code=`, which the frontend sends to
  // /oauth/exchange (lib/auth-session.ts) from any page.
  const emailRedirectTo = returnUrl(req, ONBOARDING_APP_PATH);

  try {
    // PKCE: the link in the confirmation email carries a one-time code instead
    // of the tokens. Its verifier stays in this browser (HttpOnly cookie), so
    // the user is logged in automatically when they open the link here. On
    // another device the email is still confirmed; they just log in.
    const { verifier, challenge } = createPkcePair();
    const { data, error: signUpError } = await signUpWithPkce({
      email,
      password,
      captchaToken,
      redirectTo: emailRedirectTo,
      challenge,
    });

    if (signUpError) {
      if (signUpError.status === 0) throw new Error(signUpError.message);
      return res.status(400).json({ error: signUpError.message });
    }

    if (isAuthSession(data)) {
      // Email confirmation disabled in the Supabase dashboard: a session
      // was already returned. Same cookies as /login.
      setSessionCookies(res, data, sessionExpiresAt(data));
      return res.json({
        user: { id: data.user.id, email: data.user.email },
      });
    }

    // Email confirmation enabled: no session yet, user must confirm their inbox.
    setPkceVerifierCookie(res, verifier, EMAIL_LINK_VERIFIER_MAX_AGE_SECONDS);
    return res.json({ requiresEmailConfirmation: true });
  } catch (error) {
    logger.error({ error: errorForLog(error) }, 'Register error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Hands the browser a CSRF cookie when it has none yet (a session that was
// never created by /login, e.g. right after signup), so it can echo it in the
// X-CSRF-Token header that /refresh requires. Safe to expose: another site
// can make the browser call this, but it cannot read the cookie value it
// sets, so it still cannot produce a matching header.
router.get(API_ROUTE_PATHS.CSRF, (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  if (!req.cookies?.[CSRF_TOKEN_COOKIE_NAME]) {
    setCsrfCookie(res, crypto.randomBytes(CSRF_TOKEN_RANDOM_BYTES).toString('hex'));
  }
  res.json({ ok: true });
});

// "Continue with Google", step 1 (PKCE). Creates a secret verifier, keeps it
// in an HttpOnly cookie, and returns the Supabase URL to send the browser to.
// Google then comes back to /onboarding with `?code=` (no tokens in the URL).
router.post(API_ROUTE_PATHS.OAUTH_GOOGLE, oauthLimiter, (req: Request, res: Response) => {
  const redirectTo = returnUrl(req, ONBOARDING_APP_PATH);
  if (!redirectTo) {
    return res.status(400).json({ error: 'Origin not allowed' });
  }
  const { verifier, challenge } = createPkcePair();
  setPkceVerifierCookie(res, verifier, OAUTH_VERIFIER_MAX_AGE_SECONDS);
  res.set('Cache-Control', 'no-store');
  return res.json({ url: oauthAuthorizeUrl(GOOGLE_PROVIDER, redirectTo, challenge) });
});

// Step 2 for Google, the signup email and the email-change email: the page
// the user lands on sends the one-time `code` here. Together with the
// verifier from the cookie (set when the flow started, in this browser),
// Supabase turns it into a session, which goes into our HttpOnly cookies.
// Fails when the link was opened in another browser (no verifier), or the
// code was already used or expired.
router.post(API_ROUTE_PATHS.OAUTH_EXCHANGE, oauthLimiter, async (req: Request, res: Response) => {
  const code = (req.body as { code?: unknown } | undefined)?.code;
  const verifier = req.cookies?.[PKCE_VERIFIER_COOKIE_NAME];
  // A verifier is single-use: drop it whatever happens next.
  clearPkceVerifierCookie(res);

  if (!isValidAuthCode(code) || !isValidPkceVerifier(verifier)) {
    return res.status(400).json({ error: 'Invalid or expired link' });
  }

  try {
    const { data: session, error } = await exchangeAuthCode(code, verifier);
    if (error || !session?.access_token || !session.refresh_token || !session.user?.id) {
      if (error?.status === 0) throw new Error(error.message);
      logger.warn({ status: error?.status, code: error?.code }, 'PKCE code exchange refused');
      return res.status(400).json({ error: 'Invalid or expired link' });
    }

    const expiresAt = sessionExpiresAt(session);
    setSessionCookies(res, session, expiresAt);
    return res.json(sessionBody(session.user, expiresAt));
  } catch (error) {
    logger.error({ error: errorForLog(error) }, 'Code exchange error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;