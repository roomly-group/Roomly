import { useEffect, useState } from 'react';
import { Redirect } from 'wouter';
import { getUserRole, UserRole } from '@/lib/auth-role';
import { supabase } from '@/lib/supabase';
import NotFound from '@/pages/not-found';
import { useLanguage } from '@/lib/i18n';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    async function loadRole() {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        if (!user) {
          setRole('user'); // treat as normal user if no session
          setLoading(false);
          return;
        }
        const fetchedRole = await getUserRole(user);
        setRole(fetchedRole);
      } catch (err) {
        console.error('Failed to fetch user role:', err);
        setRole('user'); // fallback to normal user
      } finally {
        setLoading(false);
      }
    }

    loadRole();
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

  const isAdmin = role === 'admin';

  if (!isAdmin) {
    return <NotFound />;
  }

  return <>{children}</>;
}