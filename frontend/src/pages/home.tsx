import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, GraduationCap, KeyRound, MessageCircle, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getListListingsQueryKey, useListListings } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/layout/app-shell';
import { supabase } from '@/lib/supabase';
import { RoomIllustration } from '@/components/shared/room-illustration';
import { SearchPill } from '@/components/shared/search-pill';
import { ListingCard } from '@/components/shared/listing-card';
import { LoadingCards } from '@/components/shared/loading-cards';
import { QueryError } from '@/components/shared/query-error';
import { EmptyState } from '@/components/shared/empty-state';
import { CategoryStrip } from '@/components/shared/category-strip';
import { browseHref, parseBrowseParams, useBrowseParams } from '@/hooks/use-browse-params';
import { APP_ROUTES, LISTING_GRID_CLASS } from '@/lib/constants';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';

// ===================== CONFIGURATION =====================

/** Rooms shown on the home grid: two rows of four on desktop. */
const FEATURED_LISTING_COUNT = 8 as const;
/** Universities listed in the "Dove vuoi studiare?" grid. */
const UNIVERSITY_LINK_COUNT = 12 as const;
/** Stable selectors for the homepage links. */
const HOME_TEST_IDS = {
  LINK_BROWSE_ALL: 'link-browse-all',
  LINK_EMPTY_SEARCH: 'link-empty-search',
  LINK_OWNER_CTA: 'link-owner-cta',
  LINK_UNIVERSITY_PREFIX: 'link-university-',
} as const;

const SECTION_TITLE_CLASS = 'text-[clamp(1.375rem,3vw,1.75rem)] font-black leading-[1.05] tracking-[-0.04em] text-pine';

export function Home() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { update } = useBrowseParams();
  const { data, isLoading, isError, refetch } = useListListings(undefined, {
    query: { queryKey: getListListingsQueryKey() },
  });
  const listings = useMemo(() => data ?? [], [data]);
  const [isOwner, setIsOwner] = useState(false);

  // Universities that really have rooms, with real counts: a room's zone is its closest university.
  const universities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const listing of listings) {
      if (listing.zone) counts.set(listing.zone, (counts.get(listing.zone) ?? 0) + 1);
    }
    return [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, UNIVERSITY_LINK_COUNT);
  }, [listings]);

  // Redirect non-admin users away from the home page
  useEffect(() => {
    async function checkAuthAndRole() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setLocation(APP_ROUTES.LOGIN);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_ROLE}`, {
          // No Authorization header needed - relying on HttpOnly cookie
          credentials: 'include',
        });
        if (!response.ok) {
          // Fail safe: treat as non-admin
          setLocation(APP_ROUTES.WAITLIST_CONFIRMED);
          return;
        }
        const { role, owner } = (await response.json()) as { role?: string; owner?: boolean };
        setIsOwner(owner === true);
        if (role !== 'admin' && owner !== true) {
          setLocation(APP_ROUTES.WAITLIST_CONFIRMED);
        }
      } catch (err) {
        console.error('Failed to fetch role:', err);
        setLocation(APP_ROUTES.WAITLIST_CONFIRMED);
      }
    }
    checkAuthAndRole();
  }, [setLocation]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8 lg:px-8 lg:pt-10">
        <section aria-labelledby="home-title" className="page-enter grid items-center gap-10 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <h1 id="home-title" className="display-heading max-w-3xl text-[clamp(2.25rem,5vw,3.25rem)] text-pine">
              {t('home.title1')} <span className="text-shutter">{t('home.title2')}</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-sage">{t('home.subtitle')}</p>
            <div className="mt-7 max-w-2xl">
              <SearchPill />
            </div>
          </div>
          <div data-scroll-tilt className="hidden justify-center lg:flex">
            <div className="floaty w-full max-w-[400px] rounded-2xl border border-pine/10 bg-paper p-3 shadow-float">
              <div className="relative">
                <RoomIllustration className="aspect-[4/3] rounded-xl" />
                <span className="absolute left-3 top-3 rounded-full bg-pine px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-mint-mist">
                  {t('waitlist.exampleLabel')}
                </span>
              </div>
              <div className="px-2 pb-1 pt-3">
                <p className="text-[15px] font-black text-pine">{t('waitlist.exampleTitle')}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-shutter">
                  <GraduationCap size={15} aria-hidden /> {t('waitlist.exampleDistance').replace('{km}', '0,8')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8">
          <CategoryStrip value="" onChange={(type) => update({ type })} />
        </div>

        <section className="mt-10" aria-labelledby="home-available">
          <div data-reveal className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 id="home-available" className={SECTION_TITLE_CLASS}>
                {t('home.startTitle1')} {t('home.startTitle2')}
              </h2>
            </div>
            <Link
              href={APP_ROUTES.SEARCH}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-black text-shutter transition-colors hover:text-pine"
              data-testid={HOME_TEST_IDS.LINK_BROWSE_ALL}
            >
              {t('home.browseAll')} <ArrowRight size={16} aria-hidden />
            </Link>
          </div>

          {isLoading ? (
            <LoadingCards count={FEATURED_LISTING_COUNT} />
          ) : isError ? (
            <QueryError onRetry={() => refetch()} />
          ) : listings.length ? (
            <div className={LISTING_GRID_CLASS}>
              {listings.slice(0, FEATURED_LISTING_COUNT).map((listing, index) => (
                <div key={listing.id} data-reveal style={{ '--reveal-delay': `${index * 90}ms` } as React.CSSProperties}>
                  <ListingCard listing={listing} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('home.emptyTitle')}
              text={t('home.emptyText')}
              action={
                <Link href={APP_ROUTES.SEARCH} className="text-sm font-black text-shutter" data-testid={HOME_TEST_IDS.LINK_EMPTY_SEARCH}>
                  {t('home.emptySearch')}
                </Link>
              }
            />
          )}
        </section>

        {universities.length > 0 && (
          <section className="mt-16" aria-labelledby="home-universities">
            <h2 data-reveal id="home-universities" className={`${SECTION_TITLE_CLASS} text-center`}>
              {t('home.universitiesTitle')}
            </h2>
            <ul className="mx-auto mt-6 flex max-w-5xl flex-wrap justify-center gap-2.5">
              {universities.map(([name, count], index) => (
                <li key={name} data-reveal style={{ '--reveal-delay': `${index * 60}ms` } as React.CSSProperties}>
                  <Link
                    href={browseHref({ ...parseBrowseParams(''), zone: name })}
                    className="group inline-flex min-h-11 items-center gap-2.5 rounded-full border border-line bg-paper py-1.5 pl-2 pr-4 text-sm font-extrabold text-pine shadow-[var(--shadow-sm)] transition-colors hover:border-shutter hover:bg-mint-mist"
                    data-testid={`${HOME_TEST_IDS.LINK_UNIVERSITY_PREFIX}${name}`}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-mint-mist text-pine group-hover:bg-paper" aria-hidden>
                      <GraduationCap size={15} />
                    </span>
                    {name}
                    <span className="rounded-full bg-mint-mist px-2 py-0.5 text-xs font-black tabular-nums text-shutter group-hover:bg-paper">
                      {count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section data-reveal className="mt-20 overflow-hidden rounded-[2rem] bg-pine text-mint-mist" aria-labelledby="home-how">
          <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:p-14">
            <div>
              <h2 id="home-how" className="display-heading text-[clamp(1.75rem,3.5vw,2.5rem)] text-mint-mist">
                {t('chiSiamo.howTitle')}
              </h2>
              <ol className="mt-8 space-y-6">
                {[
                  { title: t('waitlist.step1Title'), text: t('waitlist.step1Text') },
                  { title: t('waitlist.step2Title'), text: t('waitlist.step2Text') },
                  { title: t('waitlist.step3Title'), text: t('waitlist.step3Text') },
                ].map((step, index) => (
                  <li
                    key={step.title}
                    data-reveal
                    style={{ '--reveal-delay': `${index * 120}ms` } as React.CSSProperties}
                    className="flex gap-4"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mint-mist text-sm font-black tabular-nums text-pine">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-lg font-black">{step.title}</h3>
                      <p className="mt-1 max-w-md text-[15px] leading-6 text-mint-wash">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-mint-mist/15 pt-6 text-sm font-bold">
                {[t('home.trustBoxTitle'), t('home.trustTitle')].map((fact) => (
                  <li key={fact} className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-mint-wash" aria-hidden /> {fact}
                  </li>
                ))}
              </ul>
            </div>

            <div data-reveal style={{ '--reveal-delay': '200ms' } as React.CSSProperties} className="self-end rounded-2xl bg-paper p-6 text-ink sm:p-8">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-sun text-ink" aria-hidden>
                <KeyRound size={19} />
              </span>
              <h3 className="mt-5 text-xl font-black text-pine">{t('home.ownersHeadline')}</h3>
              <p className="mt-2 text-[15px] leading-6 text-sage">{t('home.ownersText')}</p>
              {isOwner ? (
                <Link
                  href={APP_ROUTES.OWNER_DASHBOARD}
                  className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-shutter px-5 text-sm font-black text-mint-mist transition-colors hover:bg-pine"
                  data-testid={HOME_TEST_IDS.LINK_OWNER_CTA}
                >
                  {t('home.ownersCta')} <ArrowRight size={16} aria-hidden />
                </Link>
              ) : (
                <Link
                  href={APP_ROUTES.CONTACT}
                  className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-shutter px-5 text-sm font-black text-mint-mist transition-colors hover:bg-pine"
                >
                  {t('chiSiamo.ctaContact')} <ArrowRight size={16} aria-hidden />
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
