import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';
import { useLanguage } from '@/lib/i18n';
import { GoogleColorIcon } from '@/components/shared/brand-icons';

// ===================== CONFIGURATION =====================

/** Origin of our Supabase project: the only place the Google button may send the browser. */
const SUPABASE_ORIGIN = new URL(import.meta.env.VITE_SUPABASE_URL).origin;

// Whether Google is switched on in Supabase (Authentication → Sign In / Providers),
// read once per page load from Supabase's public settings endpoint.
let googleEnabledRequest: Promise<boolean> | null = null;
function loadGoogleEnabled(): Promise<boolean> {
  googleEnabledRequest ??= fetch(new URL('/auth/v1/settings', import.meta.env.VITE_SUPABASE_URL), {
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((settings: { external?: { google?: boolean } } | null) => settings?.external?.google === true)
    .catch(() => false);
  return googleEnabledRequest;
}

/**
 * "Continua con Google", followed by an "oppure" divider before the email
 * form. Live, the button only appears once Google is switched on in Supabase,
 * so nobody meets a button that cannot work. In development it always shows,
 * so the layout can be checked before the provider is set up.
 */
export function OAuthButtons() {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadGoogleEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!import.meta.env.DEV && !enabled) return null;

  async function start() {
    setError(null);
    if (!enabled) {
      setError(t('auth.oauthGoogleUnavailable'));
      return;
    }
    setPending(true);
    // The backend starts a PKCE login: it keeps the secret verifier in an
    // HttpOnly cookie and gives back the Supabase URL. Google then sends the
    // user back to the onboarding with a one-time `?code=` (no tokens in the
    // URL), which lib/auth-session.ts trades for session cookies.
    try {
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.OAUTH_GOOGLE}`, {
        method: 'POST',
        credentials: 'include',
      });
      const { url } = (response.ok ? await response.json() : {}) as { url?: unknown };
      // Only ever leave for our own Supabase project, never for an unexpected address.
      if (typeof url !== 'string' || new URL(url).origin !== SUPABASE_ORIGIN) throw new Error('Unexpected OAuth URL');
      window.location.assign(url);
    } catch {
      setPending(false);
      setError(t('auth.oauthError'));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => void start()}
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-field bg-paper px-4 text-[15px] font-extrabold text-ink transition-[border-color,background-color,transform] duration-200 hover:border-shutter hover:bg-mint-mist active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="button-oauth-google"
      >
        {pending ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <GoogleColorIcon />}
        {t('auth.continueWithGoogle')}
      </button>

      {error ? (
        <p className="text-sm font-semibold text-terracotta" role="alert">
          {error}
        </p>
      ) : null}

      <div className="my-2 flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.15em] text-sage" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        {t('auth.orDivider')}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
