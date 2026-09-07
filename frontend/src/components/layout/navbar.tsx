import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Menu,
  MessageCircle,
  MoveUpRight,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import roomlyMark from '@assets/logo_no_background.png';
import { useLanguage } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-selector';
import { ProfileMenu } from '@/components/layout/profile-menu';
import { supabase } from '@/lib/supabase';
import { getUserRole } from '@/lib/auth-role';

const STATIC_PATHS = ['/chi-siamo', '/contatti', '/privacy', '/termini', '/cookie'];

// Nav items whose `key` is in this set are only shown to admins; plain
// authenticated users (role: 'user') never see them.
const ADMIN_ONLY_NAV_KEYS = ['find-a-room', 'messages'];

// Resolves whether the current session belongs to an admin. Defaults to
// false until resolved, so restricted nav items never flash on screen.
function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        const role = await getUserRole(user);
        if (!cancelled) setIsAdmin(role === 'admin');
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    }

    loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}

// The ONE navbar for the whole app. It reads the current route and renders
// itself accordingly, so every page just drops in `<Navbar />` with no
// props — no more per-page hardcoded headers or variant/rightContent wiring.
//
//   /, /waitlist              -> guest header (language picker + register)
//   /waitlist/confirmed       -> logo + ProfileMenu (with waitlist position)
//   legal pages (STATIC_PATHS)-> logo + "back home" link
//   everything else           -> full app header (nav links + ProfileMenu),
//                                "owner" mode is detected from the /owner prefix
export function Navbar() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = useIsAdmin();
  const [position, setPosition] = useState<number | null>(null);
  const [positionLoading, setPositionLoading] = useState(true);

  const isWaitlistConfirmed = location === '/waitlist/confirmed';
  const isGuest = location === '/' || location === '/waitlist';
  const isStatic = STATIC_PATHS.includes(location);
  const isApp = !isWaitlistConfirmed && !isGuest && !isStatic;
  const owner = location.startsWith('/owner');

  useEffect(() => {
    if (!isWaitlistConfirmed) return;
    let cancelled = false;
    fetch('/api/waitlist/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setPosition(data.position);
      })
      .catch(() => {
        if (!cancelled) setPosition(107);
      })
      .finally(() => {
        if (!cancelled) setPositionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isWaitlistConfirmed]);

  const logo = (
    <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo">
      <img
        src={roomlyMark}
        alt={isApp ? '' : 'Roomly'}
        className={isApp ? 'h-12 w-12 object-contain' : 'h-8 w-8 object-contain'}
      />
      <span
        className={
          isApp
            ? 'text-xl font-black tracking-[-0.05em] text-[#085041]'
            : 'text-lg font-black tracking-[-0.03em] text-[#085041]'
        }
      >
        roomly
      </span>
    </Link>
  );

  if (isApp) {
    const allLinks = owner
      ? [
          { href: '/owner', key: 'overview', label: t('nav.overview'), icon: LayoutDashboard },
          { href: '/owner/messages', key: 'messages', label: t('nav.messages'), icon: MessageCircle },
          { href: '/owner/profile', key: 'my-profile', label: t('nav.myProfile'), icon: UserRound },
        ]
      : [
          { href: '/', key: 'find-a-room', label: t('nav.findRoom'), icon: Search },
          { href: '/messages', key: 'messages', label: t('nav.messages'), icon: MessageCircle },
          { href: '/profile', key: 'my-profile', label: t('nav.myProfile'), icon: UserRound },
        ];

    // "Trova una stanza" / "Messaggi" (and their owner equivalents) are
    // admin-only; plain authenticated users only ever see "Il mio profilo".
    const links = allLinks.filter(
      (link) => isAdmin || !ADMIN_ONLY_NAV_KEYS.includes(link.key),
    );

    return (
      <header className="sticky top-0 z-30 border-b border-[#dbe8e0] bg-[#F1EFE8]/95 backdrop-blur">
        <div className="mx-auto flex h-[4.5rem] max-w-[1320px] items-center justify-between px-5 lg:px-8">
          {logo}

          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const Icon = link.icon;
              const active =
                location === link.href ||
                (link.href !== '/' && location.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-extrabold transition-colors ${
                    active
                      ? 'bg-[#E1F5EE] text-[#085041]'
                      : 'text-[#527067] hover:bg-[#e7eee8]'
                  }`}
                  data-testid={`link-nav-${link.key}`}
                >
                  <Icon size={16} strokeWidth={2.4} /> {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href={owner ? '/' : '/owner'}
                className="hidden rounded-xl px-3 py-2 text-sm font-extrabold text-[#0F6E56] hover:bg-[#E1F5EE] sm:inline-flex"
                data-testid="link-switch-role"
              >
                {owner ? t('nav.lookingForRoom') : t('nav.listRoom')}
              </Link>
            )}
            <button
              className="rounded-xl p-2.5 text-[#085041] hover:bg-[#E1F5EE] md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="button-open-mobile-menu"
              aria-label={t('nav.openMenu')}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <ProfileMenu profileHref={owner ? '/owner/profile' : '/profile'} />
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-[#dbe8e0] bg-[#F1EFE8] p-3 md:hidden">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 font-extrabold text-[#085041] hover:bg-[#E1F5EE]"
                data-testid={`link-mobile-${link.key}`}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href={owner ? '/' : '/owner'}
                onClick={() => setMobileOpen(false)}
                className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 font-extrabold text-[#0F6E56]"
                data-testid="link-mobile-switch-role"
              >
                <MoveUpRight size={18} />
                {owner ? t('nav.backToHunting') : t('nav.listRoom')}
              </Link>
            )}
          </div>
        )}
      </header>
    );
  }

  if (isWaitlistConfirmed) {
    return (
      <div className="flex items-center justify-between gap-3">
        {logo}
        <ProfileMenu
          profileHref="/profile"
          extra={
            <div className="flex items-center justify-between rounded-xl bg-[#E1F5EE] px-3 py-2.5">
              <span className="text-xs font-bold text-[#527067]">
                {t('waitlistConfirmed.menuPositionLabel')}
              </span>
              <span className="text-sm font-black text-[#085041]">
                {positionLoading ? '…' : `#${position ?? '--'}`}
              </span>
            </div>
          }
        />
      </div>
    );
  }

  if (isStatic) {
    return (
      <div className="flex items-center justify-between gap-3">
        {logo}
        <Link href="/" className="text-sm font-extrabold text-[#085041] hover:text-[#0F6E56]">
          {t('searchPage.backHome')}
        </Link>
      </div>
    );
  }

  // Guest / waitlist landing page (default).
  return (
    <div className="flex items-center justify-between gap-3">
      {logo}
      <div className="flex items-center gap-3">
        <LanguagePicker />
        <Link
          href="/register"
          className="hidden text-sm font-extrabold text-[#085041] hover:text-[#0F6E56] sm:block"
          data-testid="link-nav-register"
        >
          {t('waitlist.navRegister')}
        </Link>
      </div>
    </div>
  );
}

export default Navbar;
