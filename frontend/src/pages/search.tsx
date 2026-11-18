import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Listing } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { useFormat } from '@/hooks/use-format';
import { useSearchListings } from '@/hooks/use-search-listings';
import { BROWSE_FLAG_KEYS, useBrowseParams } from '@/hooks/use-browse-params';
import { SearchPill } from '@/components/shared/search-pill';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/shared/button';
import { ListingCard } from '@/components/shared/listing-card';
import { LoadingCards } from '@/components/shared/loading-cards';
import { QueryError } from '@/components/shared/query-error';
import { EmptyState } from '@/components/shared/empty-state';
import { CategoryStrip } from '@/components/shared/category-strip';
import { FiltersSheet, type FilterFlags } from '@/components/shared/filters-sheet';
import { LISTING_GRID_CLASS, SEARCH_RADIUS_KM } from '@/lib/constants';
import { cn } from '@/lib/utils';

// ===================== CONFIGURATION =====================

/** Stable selectors for search results and actions. */
const SEARCH_TEST_IDS = {
  TEXT_RESULTS: 'text-search-results',
  GRID_RESULTS: 'grid-search-results',
  BUTTON_CLEAR_FILTERS: 'button-clear-filters',
  NEXT_PAGE_SENTINEL: 'search-next-page-sentinel',
} as const;

/**
 * Infinite scroll (RMY-13): the next page starts loading when the bottom of
 * the grid comes within this distance of the screen, so it is usually ready
 * before the student reaches the end.
 */
const NEXT_PAGE_PRELOAD_MARGIN = '800px 0px' as const;
/** Skeleton cards shown under the grid while the next page loads. */
const NEXT_PAGE_SKELETON_COUNT = 4 as const;
/** Skeleton cards shown while the first page loads. */
const FIRST_PAGE_SKELETON_COUNT = 8 as const;
/** Appended to the result count while more pages can still be loaded ("100+"). */
const MORE_RESULTS_SUFFIX = '+' as const;

// Type and filters apply on the client: the API only filters by university and
// budget, and returns its matches one page at a time (nearest/newest first,
// RMY-13), so the counts cover the pages loaded so far.
function matches(listing: Listing, type: string, flags: FilterFlags) {
  return (
    (!type || listing.propertyType === type) &&
    (!flags.furnished || listing.furnished) &&
    (!flags.bills || (listing.features?.spese_incluse?.length ?? 0) > 0) &&
    (!flags.pets || listing.petsAllowed) &&
    (!flags.smokers || listing.smokersAllowed) &&
    flags.features.every((key) => {
      const [group, option] = key.split('.') as [keyof NonNullable<Listing['features']>, string];
      return listing.features?.[group]?.includes(option) ?? false;
    })
  );
}

export function SearchPage() {
  const { t } = useLanguage();
  const format = useFormat();
  const { params, update } = useBrowseParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const request = useMemo(
    () => ({
      ...(params.zone ? { zone: params.zone } : {}),
      ...(params.maxPrice ? { maxPrice: Number(params.maxPrice) } : {}),
    }),
    [params.zone, params.maxPrice],
  );

  // Pages of results; the previous results stay on screen while a new budget or university loads.
  const {
    listings: data,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useSearchListings(request);

  const flags = useMemo<FilterFlags>(
    () => ({ furnished: params.furnished, bills: params.bills, pets: params.pets, smokers: params.smokers, features: params.features }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.furnished, params.bills, params.pets, params.smokers, params.features.join(',')],
  );
  const activeFilterCount = BROWSE_FLAG_KEYS.filter((key) => flags[key]).length + flags.features.length;
  const results = useMemo(() => (data ?? []).filter((listing) => matches(listing, params.type, flags)), [data, params.type, flags]);
  const countFor = useCallback(
    (draft: FilterFlags) => (data ?? []).filter((listing) => matches(listing, params.type, draft)).length,
    [data, params.type],
  );

  const count = results.length;
  // "100+" while more pages exist: the exact total is only known at the end.
  const countLabel = `${count}${hasNextPage ? MORE_RESULTS_SUFFIX : ''}`;
  const resultLine = [
    params.zone
      ? (count === 1 && !hasNextPage ? t('searchPage.resultsNearOne') : t('searchPage.resultsNear'))
          .replace('{n}', countLabel)
          .replace('{radius}', String(SEARCH_RADIUS_KM))
      : (count === 1 && !hasNextPage ? t('searchPage.resultsAllOne') : t('searchPage.resultsAll')).replace('{n}', countLabel),
    params.maxPrice ? t('searchPage.underBudget').replace('{price}', format.price(Number(params.maxPrice))) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const clearAll = () =>
    update({ zone: '', maxPrice: '', type: '', furnished: false, bills: false, pets: false, smokers: false, features: [] });

  // Infinite scroll: an invisible marker under the grid loads the next page
  // when it nears the screen. The observer is rebuilt after every page, and a
  // new observer reports at once if the marker is still visible: so when the
  // filters hide most of a page, the next one keeps loading on its own.
  // Stops after a failed page (the retry button below takes over).
  const sentinelRef = useRef<HTMLDivElement>(null);
  const canLoadMore = Boolean(hasNextPage) && !isFetchingNextPage && !isFetchNextPageError && !isLoading;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canLoadMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage();
      },
      { rootMargin: NEXT_PAGE_PRELOAD_MARGIN },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, fetchNextPage, data.length]);

  // Filters hid everything loaded so far but more pages exist: keep loading instead of saying "no results".
  const waitingForMore = count === 0 && Boolean(hasNextPage) && !isFetchNextPageError;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8 lg:px-8 lg:pt-10">
        <div>
          <h1 className="display-heading max-w-3xl text-[clamp(2.25rem,5vw,2.75rem)] text-pine">
            {params.zone ? t('searchPage.nearTitle').replace('{university}', params.zone) : t('searchPage.title')}
          </h1>
          <p className="mt-3 min-h-6 text-[15px] font-bold text-sage" aria-live="polite" data-testid={SEARCH_TEST_IDS.TEXT_RESULTS}>
            {isLoading ? <span className="skeleton inline-block h-4 w-56 rounded align-middle" /> : resultLine}
          </p>
          <div className="mt-6 max-w-3xl">
            <SearchPill />
          </div>
        </div>

        <div className="mt-6">
          <CategoryStrip
            value={params.type}
            onChange={(type) => update({ type })}
            filterCount={activeFilterCount}
            onOpenFilters={() => setFiltersOpen(true)}
          />
        </div>

        <div className="mt-8">
          {isLoading || waitingForMore ? (
            <LoadingCards count={FIRST_PAGE_SKELETON_COUNT} />
          ) : isError && !isFetchNextPageError ? (
            <QueryError onRetry={() => refetch()} />
          ) : count ? (
            <div
              className={cn(
                LISTING_GRID_CLASS,
                'transition-opacity duration-200',
                isFetching && !isFetchingNextPage && 'opacity-60',
              )}
              aria-busy={isFetching}
              data-testid={SEARCH_TEST_IDS.GRID_RESULTS}
            >
              {results.map((listing, index) => (
                <div key={listing.id} data-reveal style={{ '--reveal-delay': `${(index % 4) * 80}ms` } as React.CSSProperties}>
                  <ListingCard listing={listing} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('searchPage.emptyTitle')}
              text={t('searchPage.emptyText')}
              action={
                <Button variant="secondary" onClick={clearAll} data-testid={SEARCH_TEST_IDS.BUTTON_CLEAR_FILTERS}>
                  {t('searchPage.clearFilters')}
                </Button>
              }
            />
          )}

          {/* Next page: skeletons while it loads, a friendly retry if it failed. */}
          {isFetchingNextPage && count > 0 && (
            <div className="mt-6">
              <LoadingCards count={NEXT_PAGE_SKELETON_COUNT} />
            </div>
          )}
          {isFetchNextPageError && (
            <div className="mt-6">
              <QueryError onRetry={() => void fetchNextPage()} />
            </div>
          )}
          {hasNextPage && <div ref={sentinelRef} className="h-px" aria-hidden data-testid={SEARCH_TEST_IDS.NEXT_PAGE_SENTINEL} />}
        </div>

        <FiltersSheet
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          value={flags}
          onApply={(next) => update(next)}
          countFor={countFor}
        />
      </div>
    </AppShell>
  );
}
