import { useCallback, useMemo, useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import type { Listing } from '@workspace/api-client-react';
import { getListListingsQueryKey, useListListings } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { useFormat } from '@/hooks/use-format';
import { BROWSE_FLAG_KEYS, useBrowseParams } from '@/hooks/use-browse-params';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/shared/button';
import { ListingCard } from '@/components/shared/listing-card';
import { LoadingCards } from '@/components/shared/loading-cards';
import { QueryError } from '@/components/shared/query-error';
import { EmptyState } from '@/components/shared/empty-state';
import { CategoryStrip } from '@/components/shared/category-strip';
import { PageIntro } from '@/components/shared/page-intro';
import { TrattaScaleKey } from '@/components/shared/tratta';
import { FiltersSheet, type FilterFlags } from '@/components/shared/filters-sheet';
import { LISTING_GRID_CLASS, SEARCH_RADIUS_KM } from '@/lib/constants';
import { cn } from '@/lib/utils';

// ===================== CONFIGURATION =====================

/** Stable selectors for search results and actions. */
const SEARCH_TEST_IDS = {
  TEXT_RESULTS: 'text-search-results',
  GRID_RESULTS: 'grid-search-results',
  BUTTON_CLEAR_FILTERS: 'button-clear-filters',
} as const;

// Type and filters apply on the client: the API only filters by university and
// budget, and returns every match at once, so the counts stay exact.
function matches(listing: Listing, type: string, flags: FilterFlags) {
  return (
    (!type || listing.propertyType === type) &&
    (!flags.furnished || listing.furnished) &&
    (!flags.bills || (listing.features?.spese_incluse?.length ?? 0) > 0) &&
    (!flags.pets || listing.petsAllowed) &&
    (!flags.smokers || listing.smokersAllowed)
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

  // Keep the previous results on screen while a new budget or university loads.
  const { data, isLoading, isError, isFetching, refetch } = useListListings(request, {
    query: { queryKey: getListListingsQueryKey(request), placeholderData: keepPreviousData },
  });

  const flags = useMemo<FilterFlags>(
    () => ({ furnished: params.furnished, bills: params.bills, pets: params.pets, smokers: params.smokers }),
    [params.furnished, params.bills, params.pets, params.smokers],
  );
  const activeFilterCount = BROWSE_FLAG_KEYS.filter((key) => flags[key]).length;
  const results = useMemo(() => (data ?? []).filter((listing) => matches(listing, params.type, flags)), [data, params.type, flags]);
  const countFor = useCallback(
    (draft: FilterFlags) => (data ?? []).filter((listing) => matches(listing, params.type, draft)).length,
    [data, params.type],
  );

  const count = results.length;
  // Legend counts: the current results under the active filters, per property type ('' = all types).
  const typeCounts = useMemo(() => {
    const scoped = (data ?? []).filter((listing) => matches(listing, '', flags));
    const counts: Record<string, number> = { '': scoped.length, stanza: 0, appartamento: 0, residenza: 0 };
    for (const listing of scoped) if (listing.propertyType) counts[listing.propertyType] = (counts[listing.propertyType] ?? 0) + 1;
    return counts;
  }, [data, flags]);
  const resultLine = [
    params.zone
      ? (count === 1 ? t('searchPage.resultsNearOne') : t('searchPage.resultsNear'))
          .replace('{n}', String(count))
          .replace('{radius}', String(SEARCH_RADIUS_KM))
      : (count === 1 ? t('searchPage.resultsAllOne') : t('searchPage.resultsAll')).replace('{n}', String(count)),
    params.maxPrice ? t('searchPage.underBudget').replace('{price}', format.price(Number(params.maxPrice))) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const clearAll = () =>
    update({ zone: '', maxPrice: '', type: '', furnished: false, bills: false, pets: false, smokers: false });

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 pb-20 pt-10 lg:px-8 lg:pt-14">
        <PageIntro
          title={params.zone ? t('searchPage.nearTitle').replace('{university}', params.zone) : t('searchPage.title')}
          className="mb-8"
          action={
            <div className="flex flex-col gap-1.5 lg:items-end">
              <h2
                className="min-h-6 text-[17px] font-extrabold text-pine lg:text-right"
                aria-live="polite"
                data-testid={SEARCH_TEST_IDS.TEXT_RESULTS}
              >
                {isLoading ? <span className="skeleton inline-block h-4 w-56 rounded-sheet align-middle" /> : resultLine}
              </h2>
              {/* The key only where the cards draw a tratta: a search by university. */}
              {params.zone && <TrattaScaleKey />}
            </div>
          }
        />

        <CategoryStrip
          value={params.type}
          onChange={(type) => update({ type })}
          counts={isLoading ? undefined : typeCounts}
          filterCount={activeFilterCount}
          onOpenFilters={() => setFiltersOpen(true)}
        />

        <div className="mt-8">
          {isLoading ? (
            <LoadingCards count={8} />
          ) : isError ? (
            <QueryError onRetry={() => refetch()} />
          ) : count ? (
            <div
              className={cn(LISTING_GRID_CLASS, 'transition-opacity duration-200', isFetching && 'opacity-60')}
              aria-busy={isFetching}
              data-testid={SEARCH_TEST_IDS.GRID_RESULTS}
            >
              {results.map((listing) => (
                <ListingCard listing={listing} key={listing.id} />
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
