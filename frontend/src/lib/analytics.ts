import { APP_ROUTES } from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Google Analytics 4 measurement ID (public, not a secret). */
export const GA_MEASUREMENT_ID = 'G-W2FXJDH258' as const;
/** gtag.js loader URL. */
const GA_SCRIPT_URL = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}` as const;
/**
 * gtag.js opt-out flag: while `window[GA_DISABLE_FLAG]` is true no hit is sent.
 * Used to keep GA silent on the pages that are not tracked (the logged-in app).
 */
const GA_DISABLE_FLAG = `ga-disable-${GA_MEASUREMENT_ID}` as const;
/** Browser-storage key holding the visitor's analytics choice. */
const CONSENT_STORAGE_KEY = 'roomly-analytics-consent' as const;
/** Window event fired when the choice changes, so the banner and cookie page stay in sync. */
export const CONSENT_CHANGE_EVENT = 'roomly:analytics-consent' as const;
/** Cookie names set by GA4 (removed when consent is withdrawn). */
const GA_COOKIE_PREFIX = '_ga' as const;

/**
 * Pages where GA runs (exact paths): only public pages, plus /register so the
 * waitlist sign-up can be measured. The logged-in app is never tracked.
 */
export const ANALYTICS_TRACKED_PATHS: readonly string[] = [
  APP_ROUTES.ROOT,
  APP_ROUTES.WAITLIST,
  APP_ROUTES.ABOUT,
  APP_ROUTES.CONTACT,
  APP_ROUTES.PRIVACY,
  APP_ROUTES.TERMS,
  APP_ROUTES.COOKIES,
  APP_ROUTES.REGISTER,
];

// ===================== TYPES =====================

export type AnalyticsConsent = 'granted' | 'denied';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [GA_DISABLE_FLAG]?: boolean;
  }
}

// ===================== CONSENT =====================

/** Saved choice, or `null` when the visitor has not chosen yet (or storage is blocked). */
export function getAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

/** Saves the choice and applies it right away (load GA, or switch it off and delete its cookies). */
export function setAnalyticsConsent(consent: AnalyticsConsent): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent);
  } catch {
    // Storage blocked (private mode): the choice lasts only for this page view.
  }
  if (consent === 'granted') {
    loadAnalytics();
  } else {
    window[GA_DISABLE_FLAG] = true;
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
    deleteAnalyticsCookies();
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: consent }));
}

/** Removes the `_ga*` cookies on this domain and its parent domain. */
function deleteAnalyticsCookies(): void {
  const hostParts = window.location.hostname.split('.');
  const domains = [window.location.hostname, `.${hostParts.slice(-2).join('.')}`];
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0].trim();
    if (!name.startsWith(GA_COOKIE_PREFIX)) return;
    domains.forEach((domain) => {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`;
    });
    document.cookie = `${name}=; Max-Age=0; path=/`;
  });
}

// ===================== GOOGLE ANALYTICS =====================

/** True when the path is one of the tracked public pages. */
export function isTrackedPath(path: string): boolean {
  return ANALYTICS_TRACKED_PATHS.includes(path);
}

/**
 * Injects gtag.js once, only after consent. Advertising features stay denied
 * (Consent Mode v2) and automatic page views are off: they are sent by
 * `trackPageView` only for the tracked pages.
 */
function loadAnalytics(): void {
  window[GA_DISABLE_FLAG] = !isTrackedPath(window.location.pathname);
  if (window.gtag) {
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    return;
  }

  window.dataLayer = window.dataLayer ?? [];
  // gtag must push the `arguments` object itself, as in Google's snippet.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = GA_SCRIPT_URL;
  document.head.appendChild(script);
}

/** Loads GA on start-up when the visitor had already accepted. */
export function initAnalytics(): void {
  if (getAnalyticsConsent() === 'granted') loadAnalytics();
}

/**
 * Called on every route change: sends a page view on tracked pages and keeps
 * GA switched off everywhere else (opt-out flag).
 */
export function trackPageView(path: string): void {
  const tracked = isTrackedPath(path);
  window[GA_DISABLE_FLAG] = !tracked || getAnalyticsConsent() !== 'granted';
  if (!tracked || !window.gtag || getAnalyticsConsent() !== 'granted') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.origin + path,
    page_title: document.title,
  });
}

/** Sends a GA event (e.g. `generate_lead`) only with consent and on a tracked page. */
export function trackEvent(name: string, params: Record<string, string | number> = {}): void {
  if (!window.gtag || getAnalyticsConsent() !== 'granted' || !isTrackedPath(window.location.pathname)) return;
  window.gtag('event', name, params);
}
