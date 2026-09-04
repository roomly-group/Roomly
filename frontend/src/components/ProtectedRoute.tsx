import { useEffect, useState } from 'react';
import { Navigate } from 'wouter';
import { supabase } from '@/lib/supabase';
import { getUserRole, UserRole } from '@/lib/auth-role';
import NotFound from '@/pages/not-found';
import { PageIntro } from '@/components/shared/page-intro';
import { useLanguage } from '@/lib/i18n';

type ProtectedRouteProps = {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  redirect?: string; // optional redirect if not authorized
};

export function ProtectedRoute({ allowedRoles, children, redirect }: ProtectedRouteProps) {
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
        <PageIntro
          eyebrow={t('loading')}
          title={t('loading')}
          description={t('loadingDescription')}
        />
      </div>
    );
  }

  const isAllowed = role !== null && allowedRoles.includes(role);

  if (!isAllowed) {
    // If redirect provided, go there; else show 404
    if (redirect) {
      return <Navigate to={redirect} replace />;
    }
    return <NotFound />;
  }

  return (
    <>
      {children}
    </>
  );
}