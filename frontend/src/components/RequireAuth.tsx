import { useEffect, useState } from 'react';
import { Redirect, useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { peekLastKnownRole, peekRoleCache } from '@/lib/role-cache';
import { useAccount } from '@/lib/account-cache';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES } from '@/lib/constants';

/**
 * Sends a logged-in user whose required onboarding steps are unfinished back
 * to /onboarding, which reopens at the first step still missing (so leaving at
 * step 2 brings you back to step 2). Renders nothing while it redirects.
 */
export function useOnboardingRedirect(): boolean {
  const { account } = useAccount();
  const [location] = useLocation();
  return account?.onboarding_completato === false && location !== APP_ROUTES.ONBOARDING;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  // Se il ruolo è già noto l'utente è autenticato: niente schermata di caricamento.
  // (Il ruolo salvato viene cancellato da main.tsx se all'avvio non c'è più sessione.)
  const [known] = useState(() => (peekRoleCache() ?? peekLastKnownRole()) !== null);
  const [loading, setLoading] = useState(!known);
  const [authenticated, setAuthenticated] = useState(known);
  const { t } = useLanguage();
  const unfinishedOnboarding = useOnboardingRedirect();

  useEffect(() => {
    if (known) return;
    async function checkAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        setAuthenticated(!!data.session);
      } catch (err) {
        console.error('Failed to check auth:', err);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [known]);

  if (loading) {
    return (
      <div className="flex h-[100vh] items-center justify-center">
        <div className="text-center">
          <p className="mt-2 text-sm text-[#527067]">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Redirect to={APP_ROUTES.LOGIN} replace />;
  }

  if (unfinishedOnboarding) {
    return <Redirect to={APP_ROUTES.ONBOARDING} replace />;
  }

  return <>{children}</>;
}
