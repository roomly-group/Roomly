import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { APP_ROUTES } from '@/lib/constants';
import { GoogleColorIcon } from '@/components/shared/brand-icons';

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
    // Leaves the page for Google, which sends the user back to the onboarding
    // with the session in the URL (handled in lib/supabase.ts).
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${APP_ROUTES.ONBOARDING}` },
    });
    if (oauthError) {
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
