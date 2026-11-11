import { API_BASE_PATH, API_ROUTE_PATHS, CSRF_TOKEN_COOKIE_NAME } from '@workspace/api-zod';

// Who is logged in, as told by the backend. Replaces the browser Supabase
// client: the access and refresh tokens now live ONLY in HttpOnly cookies, so
// page JavaScript (and therefore any XSS or malicious extension) can never
// read them. This module only knows the user (id, email) and when the access
// token expires, so it can ask the backend to refresh the cookies in time.

// ===================== CONFIGURATION =====================

/** Refresh the cookies this long before the access token expires (ms). */
const REFRESH_MARGIN_MS = 60_000 as const;
/** Shortest wait before a scheduled refresh, so an almost-expired session cannot loop (ms). */
const MIN_REFRESH_DELAY_MS = 5_000 as const;
/** Longest delay setTimeout accepts (ms, 2^31 - 1). */
const MAX_TIMER_DELAY_MS = 2_147_483_647 as const;
/** Regex source matching the CSRF cookie the backend sets (readable on purpose). */
const CSRF_COOKIE_PATTERN = `(?:^|; )${CSRF_TOKEN_COOKIE_NAME}=([^;]*)` as const;
/** Query parameter of a PKCE redirect (Google, signup or email-change link) carrying the one-time code. */
const AUTH_CODE_PARAM = 'code' as const;
/** Query parameters Supabase adds when a redirect failed (e.g. expired link, Google cancelled). */
const AUTH_ERROR_PARAMS = ['error', 'error_code', 'error_description'] as const;
/** Query parameter of a failed redirect carrying Supabase's machine-readable error code. */
const AUTH_ERROR_CODE_PARAM = 'error_code' as const;
/** Supabase error code when a suspended account (banned, migration 017) tries Google login. */
const USER_BANNED_ERROR_CODE = 'user_banned' as const;
/**
 * Leftovers of the old implicit flow (links sent before the switch to PKCE):
 * `#access_token=…` or `#error=…`. Never used, only wiped from the address bar.
 */
const IMPLICIT_FLOW_HASH_PATTERN = /(?:^#|&)(?:access_token|refresh_token|error)=/;

// ===================== TYPES =====================

export type AuthUser = { id: string; email: string | null };
export type AuthSession = {
  user: AuthUser;
  /** When the access token expires (epoch ms), if the backend knows. */
  expires_at?: number;
};

/** Result of coming back from Google or an email link ('suspended': the account is suspended). */
export type AuthRedirectResult = 'none' | 'signed_in' | 'failed' | 'suspended';

// ===================== STATE =====================

let current: AuthSession | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshInflight: Promise<AuthSession | null> | null = null;

/** The logged-in user, or null. Filled in by main.tsx before the app renders. */
export function getAuthSession(): AuthSession | null {
  return current;
}

function setAuthSession(session: AuthSession | null) {
  current = session;
  scheduleRefresh();
}

/** Forgets the session in this tab (after logout or account deletion). */
export function clearAuthSession() {
  setAuthSession(null);
}

// ===================== REFRESH =====================

// Plans the next refresh just before the access token expires. Without it,
// the access cookie would expire after an hour and every API call would fail.
function scheduleRefresh() {
  if (refreshTimer !== undefined) clearTimeout(refreshTimer);
  refreshTimer = undefined;
  if (!current?.expires_at) return;
  const delay = Math.min(Math.max(current.expires_at - REFRESH_MARGIN_MS - Date.now(), MIN_REFRESH_DELAY_MS), MAX_TIMER_DELAY_MS);
  refreshTimer = setTimeout(() => void refreshSession(), delay);
}

// Timers are paused while a laptop sleeps or a tab is in the background:
// when the page becomes visible again, refresh straight away if it's due.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !current?.expires_at) return;
    if (Date.now() >= current.expires_at - REFRESH_MARGIN_MS) void refreshSession();
  });
}

const getCsrfToken = () => {
  const match = document.cookie.match(new RegExp(CSRF_COOKIE_PATTERN));
  return match ? decodeURIComponent(match[1]) : '';
};

// /refresh requires the CSRF cookie echoed in a header. A session that was not
// created by /login (e.g. right after signup) may not have one yet: ask for it.
async function ensureCsrfToken(): Promise<string> {
  const existing = getCsrfToken();
  if (existing) return existing;
  await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.CSRF}`, { credentials: 'include' }).catch(() => undefined);
  return getCsrfToken();
}

// Accepts only the expected shape: { session: { user: { id, email }, expires_at } }.
function parseSession(body: unknown): AuthSession | null {
  const session = (body as { session?: { user?: { id?: unknown; email?: unknown }; expires_at?: unknown } } | null)?.session;
  if (!session?.user || typeof session.user.id !== 'string') return null;
  return {
    user: { id: session.user.id, email: typeof session.user.email === 'string' ? session.user.email : null },
    expires_at: typeof session.expires_at === 'number' ? session.expires_at : undefined,
  };
}

/**
 * Asks the backend for fresh cookies using the refresh-token cookie.
 * Returns the session, or null once the backend says it is over (the user
 * then sees logged-out pages). A network error keeps the current session.
 */
export function refreshSession(): Promise<AuthSession | null> {
  refreshInflight ??= (async () => {
    try {
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.REFRESH}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': await ensureCsrfToken() },
      });
      if (response.ok) {
        setAuthSession(parseSession(await response.json()));
      } else if (response.status === 401) {
        setAuthSession(null);
      }
    } catch {
      // Offline for a moment: keep the session and try again when the tab is visible.
    } finally {
      refreshInflight = null;
    }
    return current;
  })();
  return refreshInflight;
}

// ===================== RESTORE AND REDIRECTS =====================

/** Reads the session from the cookies (POST /api/verify). Used at startup and right after login/signup. */
export async function restoreSession(): Promise<AuthSession | null> {
  try {
    const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.VERIFY}`, {
      method: 'POST',
      credentials: 'include',
    });
    setAuthSession(response.ok ? parseSession(await response.json()) : null);
  } catch {
    setAuthSession(null);
  }
  return current;
}

/**
 * Back from Google, or from a signup / email-change link: Supabase adds a
 * one-time `?code=` to the URL. The backend trades it (with the secret
 * verifier it kept in an HttpOnly cookie) for session cookies. The code and
 * any error or old-style token parameters are removed from the address bar
 * first, so they never stay in the browser history.
 */
export async function consumeAuthRedirect(): Promise<AuthRedirectResult> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get(AUTH_CODE_PARAM);
  const hasError = AUTH_ERROR_PARAMS.some((param) => url.searchParams.has(param));
  const hasImplicitHash = IMPLICIT_FLOW_HASH_PATTERN.test(url.hash);
  if (!code && !hasError && !hasImplicitHash) return 'none';
  // Read before the error parameters are wiped below.
  const isSuspended = url.searchParams.get(AUTH_ERROR_CODE_PARAM) === USER_BANNED_ERROR_CODE;

  url.searchParams.delete(AUTH_CODE_PARAM);
  AUTH_ERROR_PARAMS.forEach((param) => url.searchParams.delete(param));
  if (hasImplicitHash) url.hash = '';
  // replaceState (not a new entry): the URL with the code is gone from history.
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);

  if (isSuspended) return 'suspended';
  if (!code) return 'failed';
  try {
    const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.OAUTH_EXCHANGE}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const session = response.ok ? parseSession(await response.json()) : null;
    if (!session) return 'failed';
    setAuthSession(session);
    return 'signed_in';
  } catch {
    return 'failed';
  }
}
