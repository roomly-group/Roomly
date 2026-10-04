import { useEffect, useState } from 'react';
import { Redirect } from 'wouter';
import { getRoleInfo, UserRole } from '@/lib/auth-role';
import { peekRoleCache } from '@/lib/role-cache';
import { supabase } from '@/lib/supabase';
import NotFound from '@/pages/not-found';
import { useLanguage } from '@/lib/i18n';

export function RequireAdmin({
  children,
  allowOwner = false,
}: {
  children: React.ReactNode;
  allowOwner?: boolean;
}) {
  const cached = peekRoleCache();
  const [role, setRole] = useState<UserRole | null>(cached ? cached.role : null);
  const [isOwner, setIsOwner] = useState(cached ? cached.owner : false);
  const [loading, setLoading] = useState(!cached);
  const { t } = useLanguage();

  useEffect(() => {
    if (cached) return;
    async function loadRole() {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        if (!user) {
          setRole('user'); // treat as normal user if no session
          setLoading(false);
          return;
        }
        // Una sola chiamata: ruolo e owner arrivano insieme.
        const info = await getRoleInfo(user);
        setRole(info.role);
        setIsOwner(info.owner);
      } catch (err) {
        console.error('Failed to fetch user role:', err);
        setRole('user'); // fallback to normal user
      } finally {
        setLoading(false);
      }
    }

    loadRole();
  }, [allowOwner, cached]);

  if (loading) {
    return (
      <div className="flex h-[100vh] items-center justify-center">
        <div className="text-center">
          <p className="mt-2 text-sm text-[#527067]">{t('loading')}</p>
        </div>
      </div>
    );
  }

  const hasAccess = role === 'admin' || (allowOwner && isOwner);

  if (!hasAccess) {
    return <NotFound />;
  }

  return <>{children}</>;
}