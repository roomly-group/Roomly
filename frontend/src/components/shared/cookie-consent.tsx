import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Cookie } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES } from '@/lib/constants';
import {
  CONSENT_CHANGE_EVENT,
  getAnalyticsConsent,
  initAnalytics,
  isTrackedPath,
  setAnalyticsConsent,
  trackPageView,
  type AnalyticsConsent,
} from '@/lib/analytics';

// ===================== CONFIGURATION =====================

/** Stable selectors for the consent banner and the cookie-page controls. */
const COOKIE_CONSENT_TEST_IDS = {
  BANNER: 'banner-cookie-consent',
  BUTTON_ACCEPT: 'button-cookie-accept',
  BUTTON_REJECT: 'button-cookie-reject',
} as const;

/**
 * Accept and reject share the same size and weight, so refusing is as easy as
 * accepting (Garante privacy guidelines, 10 June 2021).
 */
const BUTTON_BASE_CLASS =
  'inline-flex h-11 flex-1 items-center justify-center rounded-xl px-5 text-sm font-black transition-[background-color,transform] duration-200 active:scale-[0.98] sm:flex-none';
const BUTTON_ACCEPT_CLASS = `${BUTTON_BASE_CLASS} bg-sun text-ink hover:bg-sun-hover`;
const BUTTON_REJECT_CLASS = `${BUTTON_BASE_CLASS} border border-pine/20 text-pine hover:bg-mint-mist`;

// ===================== HOOKS =====================

/** Current analytics choice, kept in sync across the banner and the cookie page. */
function useAnalyticsConsent(): AnalyticsConsent | null {
  const [consent, setConsent] = useState<AnalyticsConsent | null>(() => getAnalyticsConsent());
  useEffect(() => {
    const sync = () => setConsent(getAnalyticsConsent());
    window.addEventListener(CONSENT_CHANGE_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, sync);
  }, []);
  return consent;
}

// ===================== COMPONENTS =====================

/**
 * Mounted once in the app: loads GA if the visitor already accepted, sends a
 * page view on every route change (tracked pages only) and shows the consent
 * banner on public pages until the visitor chooses.
 */
export function CookieConsentBanner() {
  const { t } = useLanguage();
  const [location] = useLocation();
  const consent = useAnalyticsConsent();

  useEffect(() => {
    initAnalytics();
  }, []);

  // Page view on each navigation; re-run when consent is given so the current page counts.
  useEffect(() => {
    trackPageView(location);
  }, [location, consent]);

  if (consent !== null || !isTrackedPath(location)) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-text"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6"
      data-testid={COOKIE_CONSENT_TEST_IDS.BANNER}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-pine/10 bg-paper p-5 shadow-rest sm:flex-row sm:items-center sm:gap-6">
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-mist text-shutter" aria-hidden>
            <Cookie size={19} />
          </span>
          <div>
            <p id="cookie-consent-title" className="text-sm font-black text-pine">
              {t('cookieConsent.title')}
            </p>
            <p id="cookie-consent-text" className="mt-1 text-[13px] leading-5 text-sage">
              {t('cookieConsent.text')}{' '}
              <Link href={APP_ROUTES.COOKIES} className="font-bold text-pine underline underline-offset-2">
                {t('cookieConsent.policyLink')}
              </Link>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setAnalyticsConsent('denied')}
            className={BUTTON_REJECT_CLASS}
            data-testid={COOKIE_CONSENT_TEST_IDS.BUTTON_REJECT}
          >
            {t('cookieConsent.reject')}
          </button>
          <button
            type="button"
            onClick={() => setAnalyticsConsent('granted')}
            className={BUTTON_ACCEPT_CLASS}
            data-testid={COOKIE_CONSENT_TEST_IDS.BUTTON_ACCEPT}
          >
            {t('cookieConsent.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Cookie-page block: shows the current choice and lets the visitor change it at any time. */
export function CookiePreferences() {
  const { t } = useLanguage();
  const consent = useAnalyticsConsent();
  const status =
    consent === 'granted'
      ? t('cookieConsent.statusGranted')
      : consent === 'denied'
        ? t('cookieConsent.statusDenied')
        : t('cookieConsent.statusUnset');

  return (
    <section className="rounded-2xl border border-pine/10 bg-mint-wash p-5">
      <h2 className="text-lg font-black text-pine">{t('cookieConsent.preferencesTitle')}</h2>
      <p className="mt-1 text-[15px] leading-7 text-ink">{status}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setAnalyticsConsent('denied')} className={BUTTON_REJECT_CLASS}>
          {t('cookieConsent.reject')}
        </button>
        <button type="button" onClick={() => setAnalyticsConsent('granted')} className={BUTTON_ACCEPT_CLASS}>
          {t('cookieConsent.accept')}
        </button>
      </div>
    </section>
  );
}
