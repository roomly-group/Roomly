import { useMemo, useState } from 'react';
import { Check, ChevronLeft, MapPin, SlidersHorizontal } from 'lucide-react';
import { Link } from 'wouter';
import { getListListingsQueryKey, useListListings } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { zones } from '@/lib/constants';
import { useZoneLabel } from '@/hooks/use-zone-label';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/shared/button';
import { PageIntro } from '@/components/shared/page-intro';
import { ListingCard } from '@/components/shared/listing-card';
import { LoadingCards } from '@/components/shared/loading-cards';
import { QueryError } from '@/components/shared/query-error';
import { EmptyState } from '@/components/shared/empty-state';

export function SearchPage() {
  const { t } = useLanguage();
  const zoneLabel = useZoneLabel();
  const params = new URLSearchParams(window.location.search);
  const [zone, setZone] = useState(params.get('zone') ?? '');
  const [maxPrice, setMaxPrice] = useState('');
  const [furnished, setFurnished] = useState(false);

  const request = useMemo(
    () => ({
      ...(zone ? { zone } : {}),
      ...(maxPrice ? { maxPrice: Number(maxPrice) } : {}),
      ...(furnished ? { furnished: true } : {}),
    }),
    [zone, maxPrice, furnished],
  );

  const { data, isLoading, isError, refetch } = useListListings(request, {
    query: { queryKey: getListListingsQueryKey(request) },
  });
  const listings = data ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12">
        <PageIntro
          eyebrow={t('searchPage.eyebrow')}
          title={t('searchPage.title')}
          description={t('searchPage.description')}
          action={
            <Link
              href="/"
              className="hidden items-center gap-2 text-sm font-black text-[#0F6E56] sm:flex"
              data-testid="link-back-home"
            >
              <ChevronLeft size={16} /> {t('searchPage.backHome')}
            </Link>
          }
        />

        <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-[#E1F5EE] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm font-extrabold text-[#085041]">
            <div className="rounded-xl bg-[#9FE1CB] p-2">
              <SlidersHorizontal size={18} />
            </div>
            <span>
              {listings.length} {listings.length === 1 ? t('common.room') : t('common.rooms')}{' '}
              {t('searchPage.toExplore')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-[#bedbcd] bg-[#F1EFE8] px-3 py-2 text-sm font-bold text-[#527067]">
              <MapPin size={15} />
              <select
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                className="bg-transparent outline-none"
                data-testid="select-search-zone"
              >
                <option value="">{t('searchPage.allAreas')}</option>
                {zones.map((item) => (
                  <option key={item} value={item}>
                    {zoneLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-[#bedbcd] bg-[#F1EFE8] px-3 py-2 text-sm font-bold text-[#527067]">
              <span className="font-black">£</span>
              <input
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                type="number"
                placeholder={t('searchPage.max')}
                className="w-16 bg-transparent outline-none"
                data-testid="input-search-max"
              />
            </label>

            <button
              onClick={() => setFurnished(!furnished)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-extrabold transition ${
                furnished
                  ? 'border-[#0F6E56] bg-[#0F6E56] text-[#E1F5EE]'
                  : 'border-[#bedbcd] bg-[#F1EFE8] text-[#527067]'
              }`}
              data-testid="button-filter-furnished"
            >
              {furnished && <Check size={15} />} {t('common.furnished')}
            </button>
          </div>
        </div>

        {isLoading ? (
          <LoadingCards count={6} />
        ) : isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : listings.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing, index) => (
              <ListingCard listing={listing} index={index} key={listing.id} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={t('searchPage.emptyTitle')}
            text={t('searchPage.emptyText')}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setZone('');
                  setMaxPrice('');
                  setFurnished(false);
                }}
                data-testid="button-clear-filters"
              >
                {t('searchPage.clearFilters')}
              </Button>
            }
          />
        )}
      </div>
    </AppShell>
  );
}
