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
import { getRoleInfo, mainPageFor } from '@/lib/auth-role';
import { peekLastKnownRole, peekRoleCache } from '@/lib/role-cache';
import { useAccount } from '@/lib/account-cache';
import { APP_ROUTES, SHARED_TEST_IDS } from '@/lib/constants';

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

// Nav state shared by the header and the mobile tab bar: which links the
// current role can see, owner vs. student mode, and whether this route is a
// browse page (home/search) that carries the full search pill.
export function useAppNav() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { isAdmin, isOwner } = useRoleFlags();

  const isWaitlistConfirmed = location === APP_ROUTES.WAITLIST_CONFIRMED;
  const isGuest = location === APP_ROUTES.ROOT || location === APP_ROUTES.WAITLIST;
  const isStatic = STATIC_PATHS.includes(location);
  const isApp = !isWaitlistConfirmed && !isGuest && !isStatic;
  const owner = location.startsWith(APP_ROUTES.OWNER_DASHBOARD);

  const allLinks = owner
    ? [
        { href: APP_ROUTES.OWNER_DASHBOARD, key: 'overview', label: t('nav.overview'), shortLabel: t('nav.overview'), icon: LayoutDashboard },
        { href: APP_ROUTES.OWNER_MESSAGES, key: 'messages', label: t('nav.messages'), shortLabel: t('nav.messages'), icon: MessageCircle },
        { href: APP_ROUTES.OWNER_PROFILE, key: 'my-profile', label: t('nav.myProfile'), shortLabel: t('nav.profileShort'), icon: UserRound },
      ]
    : [
        { href: APP_ROUTES.HOME, key: 'find-a-room', label: t('nav.findRoom'), shortLabel: t('nav.explore'), icon: Search },
        { href: APP_ROUTES.MESSAGES, key: 'messages', label: t('nav.messages'), shortLabel: t('nav.messages'), icon: MessageCircle },
        { href: APP_ROUTES.PROFILE, key: 'my-profile', label: t('nav.myProfile'), shortLabel: t('nav.profileShort'), icon: UserRound },
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

  const isActive = (href: string) =>
    location === href ||
    (href !== APP_ROUTES.ROOT && location.startsWith(href)) ||
    // Search results and listing pages belong to the "find a room" tab.
    (href === APP_ROUTES.HOME && (location === APP_ROUTES.SEARCH || location.startsWith(APP_ROUTES.LISTINGS)));

  // Student side: owners get a "Dashboard" button, everyone else "List a room".
  const switchLabel = owner ? t('nav.lookingForRoom') : isOwner ? t('nav.dashboard') : t('nav.listRoom');

  return {
    isApp,
    isGuest,
    isStatic,
    isWaitlistConfirmed,
    owner,
    links,
    isActive,
    showSwitch: isOwner,
    switchHref: owner ? APP_ROUTES.HOME : APP_ROUTES.OWNER_DASHBOARD,
    switchLabel,
  };
}

// The ONE navbar for the whole app. It reads the current route and renders
// itself accordingly, so every page just drops in `<Navbar />` with no
// props — no more per-page hardcoded headers or variant/rightContent wiring.
//
//   /, /waitlist              -> guest header (language picker + register)
//   /waitlist/confirmed       -> logo + ProfileMenu (with waitlist position)
//   legal pages (STATIC_PATHS)-> logo + "back home" link
//   everything else           -> full app header (product tabs + ProfileMenu),
//                                "owner" mode is detected from the /owner prefix;
//                                home and search add a second row with the search pill
export function Navbar() {
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { account } = useAccount();
  const { isApp, isStatic, isWaitlistConfirmed, owner, links, isActive, showSwitch, switchHref, switchLabel } =
    useAppNav();
  // Logo: guests go to the landing page; signed-in users to their main page
  // (the home for admins and owners, the waitlist page for everyone else).
  const logoHref = account ? mainPageFor(peekRoleCache() ?? peekLastKnownRole()) : APP_ROUTES.ROOT;

  const logo = (
    <Link href={logoHref} className="flex shrink-0 items-center gap-2.5 rounded-xl" data-testid={SHARED_TEST_IDS.LINK_LOGO}>
      <img
        src={roomlyMark}
        alt={isApp ? '' : 'Roomly'}
        className={isApp ? 'h-8 w-8 object-contain' : 'h-8 w-8 object-contain'}
      />
      <span
        className={
          isApp
            ? 'text-xl font-black tracking-[-0.05em] text-pine'
            : 'text-lg font-black tracking-[-0.03em] text-pine'
        }
      >
        roomly
      </span>
    </Link>
  );

  if (isApp) {
    return (
      <header className="sticky top-0 z-30 border-b border-line bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-6 px-5 lg:px-8">
          {logo}

          <nav aria-label={t('nav.primary')} className="mr-auto hidden items-center lg:flex">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-16 items-center px-3 text-[15px] font-extrabold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full ${
                    active ? 'text-pine after:bg-pine' : 'text-sage after:bg-transparent hover:text-pine'
                  }`}
                  data-testid={`${NAVBAR_TEST_IDS.LINK_NAV_PREFIX}${link.key}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {showSwitch && (
              <Link
                href={switchHref}
                className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-extrabold text-shutter transition-colors hover:bg-mint-mist lg:inline-flex"
                data-testid={NAVBAR_TEST_IDS.LINK_SWITCH_ROLE}
              >
                {switchLabel}
              </Link>
            )}
            {links.length > 1 && (
              <button
                className="hidden h-11 w-11 place-items-center rounded-xl text-pine transition-colors hover:bg-mint-mist sm:grid lg:hidden"
                onClick={() => setMobileOpen(!mobileOpen)}
                data-testid={NAVBAR_TEST_IDS.BUTTON_OPEN_MOBILE_MENU}
                aria-label={t('nav.openMenu')}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
            <ProfileMenu
              profileHref={owner ? APP_ROUTES.OWNER_PROFILE : APP_ROUTES.PROFILE}
              extra={
                showSwitch ? (
                  // Phones have no header switch: the profile menu carries it.
                  <Link
                    href={switchHref}
                    className="flex min-h-11 items-center gap-2 rounded-xl bg-mint-mist px-3 text-sm font-extrabold text-pine sm:hidden"
                    data-testid={NAVBAR_TEST_IDS.LINK_MOBILE_SWITCH_ROLE}
                  >
                    <MoveUpRight size={16} aria-hidden />
                    {switchLabel}
                  </Link>
                ) : undefined
              }
            />
          </div>
        </div>

        {mobileOpen && (
          <div className="hidden border-t border-line bg-cream p-3 sm:block lg:hidden">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 font-extrabold text-pine hover:bg-mint-mist"
                data-testid={`${NAVBAR_TEST_IDS.LINK_MOBILE_PREFIX}${link.key}`}
              >
                <link.icon size={18} aria-hidden />
                {link.label}
              </Link>
            ))}
            {showSwitch && (
              <Link
                href={switchHref}
                onClick={() => setMobileOpen(false)}
                className="mt-1 flex min-h-12 items-center gap-3 rounded-xl px-3 font-extrabold text-shutter hover:bg-mint-mist"
              >
                <MoveUpRight size={18} aria-hidden />
                {switchLabel}
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
        {/* The position is on the page itself, next to the invite link: not repeated here. */}
        <ProfileMenu profileHref={APP_ROUTES.PROFILE} />
      </div>
    );
  }

  if (isStatic) {
    return (
      <div className="flex items-center justify-between gap-3">
        {logo}
        <Link href={logoHref} className="text-sm font-extrabold text-pine hover:text-shutter">
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
          className="hidden text-sm font-extrabold text-pine hover:text-shutter sm:block"
          data-testid={NAVBAR_TEST_IDS.LINK_NAV_REGISTER}
        >
          {t('waitlist.navRegister')}
        </Link>
      </div>
    </div>
  );
}
