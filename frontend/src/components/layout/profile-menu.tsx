import { useEffect, useRef, useState } from 'react';
import { clearRoleCache } from '@/lib/role-cache';
import { clearAccountCache, useAccount } from '@/lib/account-cache';
import { Link, useLocation } from 'wouter';
import { ArrowRight, LogOut, Mail, Menu, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { Avatar } from '@/components/shared/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { APP_ROUTES } from '@/lib/constants';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';

// ===================== CONFIGURATION =====================

/** Stable test selectors used by profile menu and account actions. */
const PROFILE_MENU_TEST_IDS = {
  BUTTON_PROFILE_MENU: 'button-profile-menu',
  PANEL_PROFILE_INFO: 'panel-profile-info',
  LINK_FULL_PROFILE: 'link-full-profile',
  BUTTON_LOGOUT: 'button-logout',
} as const;

// Avatar button + dropdown panel with account info, an optional extra row
// (e.g. the waitlist position), a "full profile" link, and logout. Used by
// every navbar variant instead of each page hardcoding its own menu.
//
// The account's real name/email always come from /api/me (the same source
// profile.tsx uses) so the name shown here is guaranteed to match the
// profile page — never a hardcoded demo name or the raw email prefix.
export function ProfileMenu({
  profileHref,
  extra,
  logoutRedirect = APP_ROUTES.ROOT,
}: {
  profileHref: string;
  /** Extra content rendered inside the panel, above the "full profile" link. */
  extra?: React.ReactNode;
  logoutRedirect?: string;
}) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  // Shared /api/me cache: fetched once per app load and kept across pages and
  // reloads, so the header never shows a skeleton again after the first time.
  const { account, loading: accountLoading } = useAccount();
  const [fallbackEmail, setFallbackEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (accountLoading || account) return;
    let cancelled = false;
    // Fallback: at least show the auth email if /api/me isn't available.
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setFallbackEmail(data.session?.user.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [account, accountLoading]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.LOGOUT}`, { method: 'POST', credentials: 'include' });
    // Drop the in-memory Supabase session too: otherwise auto-refresh keeps
    // running and its TOKEN_REFRESHED handler re-creates the session cookies.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    clearRoleCache();
    clearAccountCache();
    setLocation(logoutRedirect);
  }

  const userEmail = account?.email ?? fallbackEmail;
  const displayName =
    account?.full_name?.trim() ||
    (userEmail ? userEmail.split('@')[0] : t('waitlistConfirmed.defaultDisplayName'));

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="flex min-h-11 items-center gap-2 rounded-full border border-mint-mist/30 py-1 pl-3 pr-1 transition-colors hover:border-mint-mist"
        data-testid={PROFILE_MENU_TEST_IDS.BUTTON_PROFILE_MENU}
        aria-expanded={menuOpen}
        aria-label={`${displayName} · ${t('nav.openMenu')}`}
      >
        {accountLoading ? (
          <>
            <Skeleton className="hidden h-4 w-20 sm:block" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </>
        ) : (
          <>
            <Menu size={16} className="text-mint-mist" aria-hidden />
            <span className="hidden text-sm font-extrabold text-mint-mist sm:block">{displayName}</span>
            <Avatar name={displayName} size="sm" />
          </>
        )}
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 z-20 mt-2 w-72 rounded-sheet border border-hairline bg-paper p-4 shadow-float"
          data-testid={PROFILE_MENU_TEST_IDS.PANEL_PROFILE_INFO}
        >
          <div className="flex items-center gap-3 border-b border-pine/10 pb-4">
            {accountLoading ? (
              <>
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </>
            ) : (
              <>
                <Avatar name={displayName} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-pine">{displayName}</p>
                  <p className="flex items-center gap-1 truncate text-xs font-semibold text-sage">
                    <Mail size={12} className="shrink-0" />
                    {userEmail ?? t('waitlistConfirmed.emailUnavailable')}
                  </p>
                </div>
              </>
            )}
          </div>

          {extra && <div className="mt-4 space-y-2">{extra}</div>}

          <Link
            href={profileHref}
            onClick={() => setMenuOpen(false)}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-control bg-pine py-2.5 text-sm font-bold text-mint-mist transition-colors hover:bg-shutter"
            data-testid={PROFILE_MENU_TEST_IDS.LINK_FULL_PROFILE}
          >
            <UserRound size={15} />
            {t('waitlistConfirmed.fullProfileLink')}
            <ArrowRight size={14} />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-control border border-pine/10 py-2.5 text-sm font-bold text-sage transition-colors hover:border-pine/25 hover:text-pine"
            data-testid={PROFILE_MENU_TEST_IDS.BUTTON_LOGOUT}
          >
            <LogOut size={15} />
            {t('waitlistConfirmed.logout')}
          </button>
        </div>
      )}
    </div>
  );
}

export default ProfileMenu;
