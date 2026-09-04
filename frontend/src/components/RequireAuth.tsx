import { useEffect, useState } from 'react';
import { Redirect } from 'wouter';
import { supabase } from '@/lib/supabase';
import NotFound from '@/pages/not-found';
import { useLanguage } from '@/lib/i18n';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
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
  }, []);

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
    return <Redirect to="/login" replace />;
  }

  return <>{children}</>;
}