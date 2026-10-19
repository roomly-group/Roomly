import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { useLanguage } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-selector';
import { RoomlyMark } from '@/components/shared/roomly-mark';
import { CityPlan } from '@/components/shared/city-plan';
import { APP_ROUTES, SHARED_TEST_IDS } from '@/lib/constants';

/** The pine band with the Roomly mark, for pages that live outside the app shell. */
export function BrandBand({ children }: { children?: ReactNode }) {
  return (
    <header className="bg-pine">
      <div className="mx-auto flex h-[72px] w-full max-w-[1320px] items-center justify-between gap-3 px-5 lg:px-8">
        <Link
          href={APP_ROUTES.ROOT}
          className="flex shrink-0 items-center gap-2.5 rounded-control"
          aria-label="Roomly"
          data-testid={SHARED_TEST_IDS.LINK_LOGO}
        >
          <RoomlyMark className="h-9 w-9" />
          <span className="text-xl font-black tracking-[-0.05em] text-mint-mist" aria-hidden>
            roomly
          </span>
        </Link>
        {children}
      </div>
    </header>
  );
}

/**
 * Shell for the login and registration pages: the pine band with the mark,
 * a left-aligned title and form, and the example city plan beside it on
 * wide screens (the one thing Roomly promises: the distance to campus).
 */
export function AuthLayout({
  title,
  lede,
  footer,
  children,
}: {
  title: string;
  lede: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-[100dvh] flex-col bg-ground text-ink">
      <BrandBand>
        <LanguagePicker />
      </BrandBand>

      <main className="mx-auto grid w-full max-w-[1320px] flex-1 gap-12 px-5 pb-20 pt-10 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:pt-16">
        <div className="page-enter min-w-0 lg:col-span-5">
          <h1 className="display-heading text-[clamp(2.25rem,4vw,3rem)] text-pine">{title}</h1>
          <p className="mt-3 max-w-md text-pretty text-[17px] leading-[1.55] text-pine-text">{lede}</p>
          <div className="mt-8 max-w-md">{children}</div>
          {footer ? <div className="mt-8 max-w-md border-t border-line pt-5 text-[15px] text-ink">{footer}</div> : null}
        </div>

        <div className="hidden lg:col-span-6 lg:col-start-7 lg:block">
          <div className="sticky top-10">
            <CityPlan />
            <p className="mt-4 max-w-sm text-pretty text-[15px] leading-6 text-sage">{t('auth.planNote')}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
