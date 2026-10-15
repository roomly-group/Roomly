import { useEffect, useState } from 'react';
import { Redirect } from 'wouter';
import { supabase } from '@/lib/supabase';
import { peekRoleCache } from '@/lib/role-cache';
import NotFound from '@/pages/not-found';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES } from '@/lib/constants';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  // Se il ruolo è già in cache l'utente è autenticato: niente schermata di caricamento.
  const known = peekRoleCache() !== null;
  const [loading, setLoading] = useState(!known);
  const [authenticated, setAuthenticated] = useState(known);
  const { t } = useLanguage();

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

  return <>{children}</>;
}