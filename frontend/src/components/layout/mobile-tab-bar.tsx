import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/lib/i18n';
import { useAppNav } from '@/components/layout/navbar';
import { APP_ROUTES } from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Stable selectors for the phone tab bar. */
const MOBILE_TAB_BAR_TEST_IDS = {
  LINK_TAB_PREFIX: 'link-tab-',
} as const;

/**
 * Phone navigation (under 640px): Esplora · Messaggi · Profilo for students,
 * Panoramica · Messaggi · Profilo for owners. A spacer keeps the footer
 * clear of the fixed bar.
 */
export function MobileTabBar() {
  const { t } = useLanguage();
  const [location] = useLocation();
  const { isApp, links, isActive } = useAppNav();
  // A listing page owns the bottom edge with its request bar.
  if (!isApp || links.length < 2 || location.startsWith(`${APP_ROUTES.LISTINGS}/`)) return null;

  return (
    <>
      <div aria-hidden className="h-[calc(76px+env(safe-area-inset-bottom))] sm:hidden" />
      <nav
        aria-label={t('nav.primary')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className="mx-auto flex h-[76px] max-w-md items-stretch px-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <li key={link.href} className="flex-1">
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-1 rounded-xl text-xs font-extrabold transition-colors ${
                    active ? 'text-shutter' : 'text-sage'
                  }`}
                  data-testid={`${MOBILE_TAB_BAR_TEST_IDS.LINK_TAB_PREFIX}${link.key}`}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
                  {link.shortLabel}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
