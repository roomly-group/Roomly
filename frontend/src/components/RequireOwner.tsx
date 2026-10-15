import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getIsOwner } from '@/lib/auth-role';
import { peekLastKnownRole, peekRoleCache } from '@/lib/role-cache';
import NotFound from '@/pages/not-found';
import { useLanguage } from '@/lib/i18n';

export function RequireOwner({ children }: { children: React.ReactNode }) {
  // Ruolo fresco o, in mancanza, l'ultimo noto (anche dopo un ricaricamento):
  // la pagina compare subito e lo stato owner si verifica in background.
  const [known] = useState(() => peekRoleCache() ?? peekLastKnownRole());
  const [isOwner, setIsOwner] = useState<boolean | null>(known ? known.owner : null);
  const [loading, setLoading] = useState(!known);
  const { t } = useLanguage();

  useEffect(() => {
    if (peekRoleCache()) return;
    let cancelled = false;
    async function checkOwnerStatus() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          if (!cancelled) setIsOwner(false);
          return;
        }

        const owner = await getIsOwner(user);
        // Verifica fallita (nulla in cache): non si declassa chi era già noto.
        if (cancelled || (!peekRoleCache() && known)) return;
        setIsOwner(owner);
      } catch (err) {
        console.error('Failed to check owner status:', err);
        if (!cancelled && !known) setIsOwner(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkOwnerStatus();
    return () => {
      cancelled = true;
    };
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

  if (!isOwner) {
    return <NotFound />;
  }

  return <>{children}</>;
}