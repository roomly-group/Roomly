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
import { PageIntro } from '@/components/shared/page-intro';
import { SectionHead } from '@/components/shared/section-head';
import { browseHref, parseBrowseParams, useBrowseParams } from '@/hooks/use-browse-params';
import { APP_ROUTES, LISTING_GRID_CLASS } from '@/lib/constants';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';

// ===================== CONFIGURATION =====================

/** Rooms shown on the home grid: two rows of four on desktop. */
const FEATURED_LISTING_COUNT = 8 as const;
/** Universities listed in the "Dove vuoi studiare?" table. */
const UNIVERSITY_LINK_COUNT = 12 as const;
/** Stable selectors for the homepage links. */
const HOME_TEST_IDS = {
  LINK_BROWSE_ALL: 'link-browse-all',
  LINK_EMPTY_SEARCH: 'link-empty-search',
  LINK_OWNER_CTA: 'link-owner-cta',
  LINK_UNIVERSITY_PREFIX: 'link-university-',
} as const;

const TEXT_LINK_CLASS =
  'inline-flex min-h-11 shrink-0 items-center gap-1 text-[15px] font-extrabold text-shutter underline decoration-shutter/40 underline-offset-4 transition-colors hover:decoration-2 hover:decoration-shutter';

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

  // Legend counts by property type ('' = every room).
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { '': listings.length };
    for (const listing of listings) {
      if (listing.propertyType) counts[listing.propertyType] = (counts[listing.propertyType] ?? 0) + 1;
    }
    for (const type of ['stanza', 'appartamento', 'residenza']) counts[type] ??= 0;
    return counts;
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
      <div className="mx-auto max-w-[1320px] px-5 pb-20 pt-10 lg:px-8 lg:pt-14">
        <PageIntro
          size="display"
          title={
            <>
              {t('home.title1')} <span className="text-shutter">{t('home.title2')}</span>
            </>
          }
          lede={t('home.subtitle')}
          action={
            !isLoading &&
            !isError && (
              <p className="text-[17px] font-extrabold text-pine lg:text-right" aria-live="polite">
                <span className="tabular-nums">{listings.length}</span> {t('home.statText')}
              </p>
            )
          }
        />

        <CategoryStrip value="" onChange={(type) => update({ type })} counts={isLoading ? undefined : typeCounts} />

        <section className="mt-10" aria-labelledby="home-available">
          <SectionHead
            id="home-available"
            title={`${t('home.startTitle1')} ${t('home.startTitle2')}`}
            className="mb-6"
            action={
              <Link href={APP_ROUTES.SEARCH} className={TEXT_LINK_CLASS} data-testid={HOME_TEST_IDS.LINK_BROWSE_ALL}>
                {t('home.browseAll')} <ArrowRight size={16} aria-hidden />
              </Link>
            }
          />

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
                <Link href={APP_ROUTES.SEARCH} className={TEXT_LINK_CLASS} data-testid={HOME_TEST_IDS.LINK_EMPTY_SEARCH}>
                  {t('home.emptySearch')}
                </Link>
              }
            />
          )}
        </section>

        {universities.length > 0 && (
          <section className="mt-[72px]" aria-labelledby="home-universities">
            <SectionHead id="home-universities" title={t('home.universitiesTitle')} className="mb-2" />
            <ul className="grid gap-x-12 md:grid-cols-2">
              {universities.map(([name, count]) => (
                <li key={name} className="border-b border-line">
                  <Link
                    href={browseHref({ ...parseBrowseParams(''), zone: name })}
                    className="group flex min-h-14 items-baseline justify-between gap-6 py-3"
                    data-testid={`${HOME_TEST_IDS.LINK_UNIVERSITY_PREFIX}${name}`}
                  >
                    <span className="min-w-0 text-[17px] font-extrabold text-pine decoration-shutter decoration-2 underline-offset-4 group-hover:underline">
                      {name}
                    </span>
                    <span className="shrink-0 text-[15px] font-bold tabular-nums text-sage">
                      {count === 1 ? t('home.universityRoomsOne') : t('home.universityRooms').replace('{n}', String(count))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-[72px]" aria-labelledby="home-owners">
          <SectionHead id="home-owners" title={t('home.ownersEyebrow')} className="mb-8" />
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className="text-[22px] font-extrabold leading-snug tracking-[-0.015em] text-pine">{t('home.ownersHeadline')}</p>
              <p className="mt-3 max-w-xl text-base leading-7 text-ink">{t('home.ownersText')}</p>
              {isOwner && (
                <Link
                  href={APP_ROUTES.OWNER_DASHBOARD}
                  className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-control bg-shutter px-5 text-[15px] font-extrabold text-mint-mist transition-colors hover:bg-pine"
                  data-testid={HOME_TEST_IDS.LINK_OWNER_CTA}
                >
                  {t('home.ownersCta')} <ArrowRight size={16} aria-hidden />
                </Link>
              )}
            </div>
            <dl className="border-t border-line lg:col-span-5 lg:col-start-8">
              {[
                { title: t('home.trustTitle'), text: t('home.trustText') },
                { title: t('home.trustBoxTitle'), text: t('home.trustBoxText') },
              ].map((fact) => (
                <div key={fact.title} className="border-b border-line py-4">
                  <dt className="text-[17px] font-extrabold text-pine">{fact.title}</dt>
                  <dd className="mt-1 text-base leading-7 text-ink">{fact.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
