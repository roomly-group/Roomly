import { API_BASE_PATH, API_ROUTE_PATHS, CSRF_HEADER_NAME, CSRF_TOKEN_COOKIE_NAME } from '@workspace/api-zod';

// CSRF protection, browser side (RMY-20). The backend rejects every
// state-changing /api request (POST, PUT, PATCH, DELETE) whose X-CSRF-Token
// header does not match the `csrf-token` cookie (backend/src/middleware/csrf.ts).
// Instead of adding the header by hand in each of the many fetch() calls,
// installCsrfFetch() wraps window.fetch once, at startup (main.tsx), so every
// call — ours and the generated API client's — gets it automatically.

// ===================== CONFIGURATION =====================

/** Methods that change nothing on the server: they never carry the header. */
const CSRF_SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Regex source matching the CSRF cookie the backend sets (readable on purpose). */
const CSRF_COOKIE_PATTERN = `(?:^|; )${CSRF_TOKEN_COOKIE_NAME}=([^;]*)` as const;

// ===================== TOKEN =====================

/** The CSRF token from the cookie, or '' when there is none yet. */
function getCsrfToken(): string {
  const match = document.cookie.match(new RegExp(CSRF_COOKIE_PATTERN));
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
}

// One shared request when several calls need the cookie at the same moment.
let csrfCookieRequest: Promise<void> | null = null;

/**
 * The CSRF token, asking the backend for the cookie first when the browser
 * has none yet (first visit, or a session not created by /login). GET /csrf
 * is a safe method, so it does not loop back through the check below.
 */
async function ensureCsrfToken(originalFetch: typeof window.fetch): Promise<string> {
  const existing = getCsrfToken();
  if (existing) return existing;
  csrfCookieRequest ??= originalFetch(`${API_BASE_PATH}${API_ROUTE_PATHS.CSRF}`, { credentials: 'include' })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      csrfCookieRequest = null;
    });
  await csrfCookieRequest;
  return getCsrfToken();
}

// ===================== FETCH WRAPPER =====================

/** True only for our own backend (same origin, under /api): the token is never sent anywhere else. */
function isOwnApiRequest(input: RequestInfo | URL): boolean {
  const raw = input instanceof Request ? input.url : String(input);
  try {
    const url = new URL(raw, window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith(`${API_BASE_PATH}/`);
  } catch {
    return false;
  }
}

let installed = false;

/** Wraps window.fetch so state-changing /api calls carry the X-CSRF-Token header. Call once, before the app renders. */
export function installCsrfFetch() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (CSRF_SAFE_METHODS.has(method) || !isOwnApiRequest(input)) {
      return originalFetch(input, init);
    }

    const token = await ensureCsrfToken(originalFetch);
    // Keep every header the caller set (on init, or on the Request object).
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    // Without a token the request goes out as is: the backend answers 403
    // and the page shows its usual friendly "something went wrong" message.
    if (token) headers.set(CSRF_HEADER_NAME, token);
    return originalFetch(input, { ...init, headers });
  };
}
