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
import { getRoleInfo } from '@/lib/auth-role';
import { peekLastKnownRole, peekRoleCache } from '@/lib/role-cache';
import { useAccount } from '@/lib/account-cache';
import { APP_ROUTES, SHARED_TEST_IDS, WAITLIST_FALLBACK_POSITION } from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Static legal and informational routes rendered with the compact navbar. */
const STATIC_PATHS: readonly string[] = [APP_ROUTES.ABOUT, APP_ROUTES.CONTACT, APP_ROUTES.PRIVACY, APP_ROUTES.TERMS, APP_ROUTES.COOKIES] as const;
/** Stable test selectors used by global navigation controls. */
const NAVBAR_TEST_IDS = {
  LINK_NAV_PREFIX: 'link-nav-',
  LINK_SWITCH_ROLE: 'link-switch-role',
  BUTTON_OPEN_MOBILE_MENU: 'button-open-mobile-menu',
  LINK_MOBILE_PREFIX: 'link-mobile-',
  LINK_MOBILE_SWITCH_ROLE: 'link-mobile-switch-role',
  LINK_NAV_REGISTER: 'link-nav-register',
} as const;

// Nav items whose `key` is in this set are only shown to admins; plain
// authenticated users (role: 'user') never see them.
const ADMIN_ONLY_NAV_KEYS = ['find-a-room', 'messages'];

// Resolves the role flags of the current session. Both default to false until
// resolved, so restricted nav items never flash on screen.
function initialRoleFlags() {
  const known = peekLastKnownRole();
  return known
    ? { isAdmin: known.role === 'admin', isOwner: known.owner }
    : { isAdmin: false, isOwner: false };
}

function useRoleFlags() {
  const [flags, setFlags] = useState(initialRoleFlags);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        const info = await getRoleInfo(user);
        // Verifica fallita (nulla in cache): non si declassa chi era già noto.
        if (user && !peekRoleCache() && peekLastKnownRole()) return;
        const next = { isAdmin: info.role === 'admin', isOwner: info.owner };
        if (!cancelled) {
          setFlags((prev) =>
            prev.isAdmin === next.isAdmin && prev.isOwner === next.isOwner ? prev : next,
          );
        }
      } catch {
        // Errore momentaneo: si tiene l'ultimo valore noto.
      }
    }

    loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  return flags;
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
  const { isAdmin, isOwner } = useRoleFlags();
  // Waitlist position comes from the shared /api/me cache (same value as /api/waitlist/me).
  const { account, loading: positionLoading } = useAccount();
  const position = account?.posizione ?? null;

  const isWaitlistConfirmed = location === APP_ROUTES.WAITLIST_CONFIRMED;
  const isGuest = location === APP_ROUTES.ROOT || location === APP_ROUTES.WAITLIST;
  const isStatic = STATIC_PATHS.includes(location);
  const isApp = !isWaitlistConfirmed && !isGuest && !isStatic;
  const owner = location.startsWith(APP_ROUTES.OWNER_DASHBOARD);

  // Define href variables for consistent usage
  // Admin switch href
  const adminSwitchHref = owner ? APP_ROUTES.HOME : APP_ROUTES.OWNER_DASHBOARD;

  const logo = (
    <Link href={APP_ROUTES.HOME} className="flex items-center gap-2.5" data-testid={SHARED_TEST_IDS.LINK_LOGO}>
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
          { href: APP_ROUTES.OWNER_DASHBOARD, key: 'overview', label: t('nav.overview'), icon: LayoutDashboard },
          { href: APP_ROUTES.OWNER_MESSAGES, key: 'messages', label: t('nav.messages'), icon: MessageCircle },
          { href: APP_ROUTES.OWNER_PROFILE, key: 'my-profile', label: t('nav.myProfile'), icon: UserRound },
        ]
      : [
          { href: APP_ROUTES.HOME, key: 'find-a-room', label: t('nav.findRoom'), icon: Search },
          { href: APP_ROUTES.MESSAGES, key: 'messages', label: t('nav.messages'), icon: MessageCircle },
          { href: APP_ROUTES.PROFILE, key: 'my-profile', label: t('nav.myProfile'), icon: UserRound },
        ];

    // "Trova una stanza" / "Messaggi" (and their owner equivalents) are
    // admin-only; plain authenticated users only ever see "Il mio profilo".
    // Verified owners always keep "Messaggi" (in both sections).
    const links = allLinks.filter(
      (link) =>
        isAdmin ||
        !ADMIN_ONLY_NAV_KEYS.includes(link.key) ||
        (isOwner && link.key === 'messages'),
    );

    // Student side: owners get a "Dashboard" button, everyone else "List a room".
    const ownerButtonLabel = isOwner ? t('nav.dashboard') : t('nav.listRoom');
    const showSwitch = isOwner;

    return (
      <header className="sticky top-0 z-30 border-b border-[#dbe8e0] bg-[#F1EFE8]/95 backdrop-blur">
        <div className="mx-auto flex h-[4.5rem] max-w-[1320px] items-center justify-between px-5 lg:px-8">
          {logo}

          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const Icon = link.icon;
              const active =
                location === link.href ||
                (String(link.href) !== APP_ROUTES.ROOT && location.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-extrabold transition-colors ${
                    active
                      ? 'bg-[#E1F5EE] text-[#085041]'
                      : 'text-[#527067] hover:bg-[#e7eee8]'
                  }`}
                  data-testid={`${NAVBAR_TEST_IDS.LINK_NAV_PREFIX}${link.key}`}
                >
                  <Icon size={16} strokeWidth={2.4} /> {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {showSwitch && (
              <Link
                href={owner ? APP_ROUTES.HOME : APP_ROUTES.OWNER_DASHBOARD}
                className="hidden rounded-xl px-3 py-2 text-sm font-extrabold text-[#0F6E56] hover:bg-[#E1F5EE] sm:inline-flex"
                data-testid={NAVBAR_TEST_IDS.LINK_SWITCH_ROLE}
              >
                {owner ? t('nav.lookingForRoom') : ownerButtonLabel}
              </Link>
            )}
            <button
              className="rounded-xl p-2.5 text-[#085041] hover:bg-[#E1F5EE] md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid={NAVBAR_TEST_IDS.BUTTON_OPEN_MOBILE_MENU}
              aria-label={t('nav.openMenu')}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <ProfileMenu profileHref={owner ? APP_ROUTES.OWNER_PROFILE : APP_ROUTES.PROFILE} />
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
                data-testid={`${NAVBAR_TEST_IDS.LINK_MOBILE_PREFIX}${link.key}`}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            ))}
            {showSwitch && (
              <Link
                href={adminSwitchHref}
                onClick={() => setMobileOpen(false)}
                className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 font-extrabold text-[#0F6E56]"
                data-testid={NAVBAR_TEST_IDS.LINK_MOBILE_SWITCH_ROLE}
              >
                <MoveUpRight size={18} />
                {owner ? t('nav.lookingForRoom') : ownerButtonLabel}
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
          profileHref={APP_ROUTES.PROFILE}
          extra={
            <div className="flex items-center justify-between rounded-xl bg-[#E1F5EE] px-3 py-2.5">
              <span className="text-xs font-bold text-[#527067]">
                {t('waitlistConfirmed.menuPositionLabel')}
              </span>
              <span className="text-sm font-black text-[#085041]">
                {positionLoading ? '…' : `#${position ?? WAITLIST_FALLBACK_POSITION}`}
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
        <Link href={APP_ROUTES.HOME} className="text-sm font-extrabold text-[#085041] hover:text-[#0F6E56]">
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
          href={APP_ROUTES.REGISTER}
          className="hidden text-sm font-extrabold text-[#085041] hover:text-[#0F6E56] sm:block"
          data-testid={NAVBAR_TEST_IDS.LINK_NAV_REGISTER}
        >
          {t('waitlist.navRegister')}
        </Link>
      </div>
    </div>
  );
}

export default Navbar;
