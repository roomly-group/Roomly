import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getListListingsQueryKey, useListListings } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/layout/app-shell';
import { supabase } from '@/lib/supabase';
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
        <section aria-labelledby="home-title" className="page-enter">
          <h1 id="home-title" className="display-heading max-w-3xl text-[clamp(2.25rem,5vw,2.75rem)] text-pine">
            {t('home.title1')} <span className="text-shutter">{t('home.title2')}</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-sage">{t('home.subtitle')}</p>
        </section>

        <div className="mt-8">
          <CategoryStrip value="" onChange={(type) => update({ type })} />
        </div>

        <section className="mt-10" aria-labelledby="home-available">
          <div className="mb-6 flex items-end justify-between gap-4">
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
              {listings.slice(0, FEATURED_LISTING_COUNT).map((listing) => (
                <ListingCard listing={listing} key={listing.id} />
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
            <h2 id="home-universities" className={SECTION_TITLE_CLASS}>
              {t('home.universitiesTitle')}
            </h2>
            <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 desk:grid-cols-6">
              {universities.map(([name, count]) => (
                <li key={name}>
                  <Link
                    href={browseHref({ ...parseBrowseParams(''), zone: name })}
                    className="group flex min-h-16 flex-col justify-center rounded-xl py-2 pr-2"
                    data-testid={`${HOME_TEST_IDS.LINK_UNIVERSITY_PREFIX}${name}`}
                  >
                    <span className="line-clamp-2 text-sm font-extrabold text-pine decoration-shutter underline-offset-4 group-hover:underline">
                      {name}
                    </span>
                    <span className="mt-0.5 text-sm tabular-nums text-sage">
                      {count === 1 ? t('home.universityRoomsOne') : t('home.universityRooms').replace('{n}', String(count))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-20 grid gap-8 border-t border-line pt-10 lg:grid-cols-3">
          <div>
            <h2 className="text-lg font-black text-pine">{t('home.trustBoxTitle')}</h2>
            <p className="mt-2 max-w-sm text-[15px] leading-6 text-sage">{t('home.trustBoxText')}</p>
          </div>
          <div>
            <h2 className="text-lg font-black text-pine">{t('home.trustTitle')}</h2>
            <p className="mt-2 max-w-sm text-[15px] leading-6 text-sage">{t('home.trustText')}</p>
          </div>
          <div>
            <h2 className="text-lg font-black text-pine">{t('home.ownersHeadline')}</h2>
            <p className="mt-2 max-w-sm text-[15px] leading-6 text-sage">{t('home.ownersText')}</p>
            {isOwner && (
              <Link
                href={APP_ROUTES.OWNER_DASHBOARD}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-extrabold text-shutter underline decoration-shutter/40 underline-offset-4 hover:decoration-shutter"
                data-testid={HOME_TEST_IDS.LINK_OWNER_CTA}
              >
                {t('home.ownersCta')} <ArrowRight size={15} aria-hidden />
              </Link>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
