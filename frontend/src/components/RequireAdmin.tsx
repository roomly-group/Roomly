import { useEffect, useState } from 'react';
import { Redirect } from 'wouter';
import { getRoleInfo, UserRole } from '@/lib/auth-role';
import { peekLastKnownRole, peekRoleCache } from '@/lib/role-cache';
import { supabase } from '@/lib/supabase';
import { APP_ROUTES } from '@/lib/constants';
import { useLanguage } from '@/lib/i18n';

export function RequireAdmin({
  children,
  allowOwner = false,
}: {
  children: React.ReactNode;
  allowOwner?: boolean;
}) {
  // Ruolo fresco o, in mancanza, l'ultimo noto (anche dopo un ricaricamento):
  // la pagina compare subito e il ruolo si verifica in background.
  const [known] = useState(() => peekRoleCache() ?? peekLastKnownRole());
  const [role, setRole] = useState<UserRole | null>(known ? known.role : null);
  const [isOwner, setIsOwner] = useState(known ? known.owner : false);
  const [loading, setLoading] = useState(!known);
  // Known role means signed in; otherwise the check below finds out.
  const [signedIn, setSignedIn] = useState(known !== null);
  const { t } = useLanguage();

  useEffect(() => {
    if (peekRoleCache()) return;
    let cancelled = false;
    async function loadRole() {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        if (!user) {
          if (!cancelled) {
            setRole('user'); // treat as normal user if no session
            setSignedIn(false);
          }
          return;
        }
        if (!cancelled) setSignedIn(true);
        // Una sola chiamata: ruolo e owner arrivano insieme.
        const info = await getRoleInfo(user);
        // Verifica fallita (nulla in cache): non si declassa chi era già noto.
        if (cancelled || (!peekRoleCache() && known)) return;
        setRole(info.role);
        setIsOwner(info.owner);
      } catch (err) {
        console.error('Failed to fetch user role:', err);
        if (!cancelled && !known) setRole('user'); // fallback to normal user
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRole();
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

  const hasAccess = role === 'admin' || (allowOwner && isOwner);

  // No access to the app yet: students go to their waitlist page, guests to the landing page.
  if (!hasAccess) {
    return <Redirect to={signedIn ? APP_ROUTES.WAITLIST_CONFIRMED : APP_ROUTES.ROOT} replace />;
  }

  return <>{children}</>;
}