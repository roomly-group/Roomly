import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getIsOwner } from '@/lib/auth-role';
import { peekRoleCache } from '@/lib/role-cache';
import NotFound from '@/pages/not-found';
import { useLanguage } from '@/lib/i18n';

export function RequireOwner({ children }: { children: React.ReactNode }) {
  const cached = peekRoleCache();
  const [isOwner, setIsOwner] = useState<boolean | null>(cached ? cached.owner : null);
  const [loading, setLoading] = useState(!cached);
  const { t } = useLanguage();

  useEffect(() => {
    if (cached) return;
    async function checkOwnerStatus() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          setIsOwner(false);
          setLoading(false);
          return;
        }

        const owner = await getIsOwner(user);
        setIsOwner(owner);
      } catch (err) {
        console.error('Failed to check owner status:', err);
        setIsOwner(false);
      } finally {
        setLoading(false);
      }
    }

    checkOwnerStatus();
  }, [cached]);

  if (loading) {
    return (
      <div className="flex h-[100vh] items-center justify-center">
        <div className="text-center">
          <p className="mt-2 text-sm text-[#527067]">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return <NotFound />;
  }

  return <>{children}</>;
}