import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, LogOut, Mail, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { Avatar } from '@/components/shared/avatar';
import { Skeleton } from '@/components/ui/skeleton';

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
  logoutRedirect = '/',
}: {
  profileHref: string;
  /** Extra content rendered inside the panel, above the "full profile" link. */
  extra?: React.ReactNode;
  logoutRedirect?: string;
}) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [account, setAccount] = useState<{ full_name?: string; email?: string } | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;

        const response = await fetch('/api/me', { credentials: 'include' });
        if (response.ok) {
          const json = await response.json();
          if (!cancelled) setAccount({ full_name: json.full_name, email: json.email });
          return;
        }
      } catch {
        // fall through to the supabase-only fallback below
      } finally {
        if (!cancelled) setAccountLoading(false);
      }

      // Fallback: at least show the auth email if /api/me isn't available.
      const { data: userData } = await supabase.auth.getUser();
      if (!cancelled) setAccount((prev) => prev ?? { email: userData.user?.email ?? undefined });
    }

    loadAccount();
    return () => {
      cancelled = true;
    };
  }, []);

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
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    setLocation(logoutRedirect);
  }

  const userEmail = account?.email ?? null;
  const displayName =
    account?.full_name?.trim() ||
    (userEmail ? userEmail.split('@')[0] : t('waitlistConfirmed.defaultDisplayName'));

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="flex items-center gap-2 rounded-full border border-[#0850411f] bg-white py-1 pl-1 pr-3 transition-colors hover:border-[#08504140]"
        data-testid="button-profile-menu"
        aria-expanded={menuOpen}
      >
        {accountLoading ? (
          <>
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="hidden h-4 w-20 sm:block" />
          </>
        ) : (
          <>
            <Avatar name={displayName} size="sm" />
            <span className="hidden text-sm font-extrabold text-[#085041] sm:block">{displayName}</span>
          </>
        )}
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-[#0850411a] bg-white p-4 shadow-[0_16px_40px_rgba(8,80,65,0.14)]"
          data-testid="panel-profile-info"
        >
          <div className="flex items-center gap-3 border-b border-[#0850411a] pb-4">
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
                  <p className="truncate text-sm font-black text-[#085041]">{displayName}</p>
                  <p className="flex items-center gap-1 truncate text-xs font-semibold text-[#527067]">
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
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#085041] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0F6E56]"
            data-testid="link-full-profile"
          >
            <UserRound size={15} />
            {t('waitlistConfirmed.fullProfileLink')}
            <ArrowRight size={14} />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#0850411a] py-2.5 text-sm font-bold text-[#527067] transition-colors hover:border-[#08504140] hover:text-[#085041]"
            data-testid="button-logout"
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
