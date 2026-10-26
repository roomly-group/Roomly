/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { API_BASE_PATH, API_ROUTE_PATHS, CSRF_TOKEN_COOKIE_NAME } from '@workspace/api-zod';

// ===================== CONFIGURATION =====================

/** Regex source matching the CSRF cookie key used by the auth-state listener. */
const CSRF_COOKIE_PATTERN = `(?:^|; )${CSRF_TOKEN_COOKIE_NAME}=([^;]*)` as const;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Make sure VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_PUBLISHABLE_KEY are set in your .env file.',
  );
}

// Single shared Supabase client for the whole auth.
// Security Implementation:
// 1. Disable automatic session persistence (persistSession: false) to prevent
//    automatic token storage in localStorage/sessionStorage by Supabase
// 2. Auto-refresh tokens to maintain session
// 3. Listen for auth state changes to update React state/context if needed
// 4. For persistent login across browser restarts, rely on HttpOnly cookie
//    set by backend /api/login endpoint
// 5. Content Security Policy (CSP) implemented in backend via helmet middleware
// 6. All user data rendered via React JSX which auto-escapes content to prevent XSS
//
// Note: Session persistence is now handled via HttpOnly cookie set by backend
// during login, rather than client-side localStorage storage.
// Token refresh is handled by calling the backend refresh endpoint when
// Supabase emits a TOKEN_REFRESHED event.
/** Max wait for a session found in the URL to reach the backend cookies before the app renders anyway (ms). */
const URL_SESSION_SYNC_TIMEOUT_MS = 10000 as const;

// Back from Google, or from the link in the confirmation email: the
// session arrives in the URL hash (#access_token=...) instead of through
// /api/login. Read it before createClient(), which clears the hash.
const hasSessionInUrl = typeof window !== 'undefined' && /(?:^#|&)access_token=/.test(window.location.hash);

let settleUrlSession: (synced: boolean) => void = () => {};
/**
 * Resolves to true once a session found in the URL has been turned into our
 * HttpOnly cookies (so API calls work), false when there was none or it failed.
 * main.tsx waits for it before deciding where a logged-in user lands.
 */
export const urlSessionSynced: Promise<boolean> = hasSessionInUrl
  ? new Promise<boolean>((resolve) => {
      settleUrlSession = resolve;
      window.setTimeout(() => resolve(false), URL_SESSION_SYNC_TIMEOUT_MS);
    })
  : Promise.resolve(false);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Prevent automatic storage in localStorage/sessionStorage
    autoRefreshToken: true, // Keep auto-refresh enabled for better UX
    detectSessionInUrl: true,
  },
});

// Keep our HttpOnly cookies in sync with whatever session the Supabase
// client currently holds:
// - TOKEN_REFRESHED: Supabase auto-refreshed the access token in memory;
//   push both fresh tokens back into the backend's cookies.
// - SIGNED_IN: fires after supabase.auth.signUp() with an immediate
//   session, and after detectSessionInUrl parses an email-confirmation
//   redirect. Neither of those goes through /api/login, so without this
//   the backend would never receive a session cookie at all.
// Both cases require refresh_token as well as access_token — the backend
// needs it to keep the refresh cookie in sync so setSession() keeps working
// after future reloads.
// Helper to get CSRF token from cookie
const getCsrfToken = () => {
  const match = document.cookie.match(new RegExp(CSRF_COOKIE_PATTERN));
  return match ? decodeURIComponent(match[1]) : '';
};

// A session that never went through /api/login (Google, confirmation
// email, signup with an immediate session) has no CSRF cookie yet: ask the
// backend for one so the X-CSRF-Token header below can match it.
async function ensureCsrfToken(): Promise<string> {
  const existing = getCsrfToken();
  if (existing) return existing;
  await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.CSRF}`, { credentials: 'include' }).catch(() => undefined);
  return getCsrfToken();
}

supabase.auth.onAuthStateChange(async (event, session) => {
  // The token in the URL was expired or invalid: stop waiting for it.
  if (!session && (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT')) settleUrlSession(false);

  if (session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
    const endpoint = event === 'SIGNED_IN'
      ? `${API_BASE_PATH}${API_ROUTE_PATHS.SESSION}`
      : `${API_BASE_PATH}${API_ROUTE_PATHS.REFRESH}`;

    const synced = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': await ensureCsrfToken(),
      },
      body: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
    })
      .then((response) => response.ok)
      .catch((err) => {
        console.error('Errore nel sincronizzare il cookie di sessione:', err);
        return false;
      });

    if (event === 'SIGNED_IN') settleUrlSession(synced);
  }
});
