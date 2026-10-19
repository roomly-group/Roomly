import { Link, useSearch } from 'wouter';
import type { Listing } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { useFormat } from '@/hooks/use-format';
import { APP_ROUTES } from '@/lib/constants';
import { Persiana } from '@/components/shared/persiana';
import { Tratta } from '@/components/shared/tratta';
import { TypeSwatch } from '@/components/shared/category-strip';
import { cn } from '@/lib/utils';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Stable test selector prefixes for listing cards. */
const LISTING_CARD_TEST_IDS = {
  CARD_LISTING_PREFIX: 'card-listing-',
  /** Kept from the old "Vedi stanza" link: now the title, inside the same card link. */
  LINK_VIEW_LISTING_PREFIX: 'link-view-listing-',
} as const;

/** The no-photo placeholder, kept under its old name for the pages that import it. */
export function ListingPhotoPlaceholder({ className, showLabel = true }: { id?: number; className?: string; showLabel?: boolean }) {
  return <Persiana className={className} showLabel={showLabel} />;
}

/**
 * Frameless listing card: the photo, then title and price on one baseline,
 * the tratta to the university (when the search measured it), and the type
 * swatch with availability. The whole card is one link.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const { t } = useLanguage();
  const format = useFormat();
  const search = useSearch();
  const someBillsIncluded = (listing.features?.spese_incluse?.length ?? 0) > 0;

  // The detail page gets the search it came from: its back link keeps the filters
  // and its distance is measured from the same university.
  const detailHref = `${APP_ROUTES.LISTINGS}/${listing.id}${search ? `?${new URLSearchParams({ from: search })}` : ''}`;
  const typeLabel = listing.apartmentLayout
    ? t(`apartmentLayout.${listing.apartmentLayout}` as TranslationKey)
    : listing.propertyType
      ? t(`propertyType.${listing.propertyType}` as TranslationKey)
      : '';

  return (
    <Link
      href={detailHref}
      className="group block rounded-sheet"
      data-testid={`${LISTING_CARD_TEST_IDS.CARD_LISTING_PREFIX}${listing.id}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-sheet bg-line">
        {listing.coverPhotoUrl ? (
          <img
            src={listing.coverPhotoUrl}
            alt=""
            crossOrigin="anonymous"
            loading="lazy"
            className="h-full w-full object-cover transition-[filter] duration-200 group-hover:brightness-95"
          />
        ) : (
          <Persiana className="h-full w-full" />
        )}
        {listing.photos > 1 && (
          <span className="absolute bottom-3 right-3 rounded-sheet bg-chip-veil px-2 py-1 text-xs font-extrabold tabular-nums text-pine">
            {listing.photos} {t('common.photos')}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3
          className="min-w-0 truncate text-[17px] font-extrabold tracking-[-0.01em] text-pine decoration-shutter decoration-2 underline-offset-4 group-hover:underline"
          data-testid={`${LISTING_CARD_TEST_IDS.LINK_VIEW_LISTING_PREFIX}${listing.id}`}
        >
          {listing.title}
        </h3>
        <p className="shrink-0 text-[17px] font-black tabular-nums text-pine">
          {format.price(listing.price)}
          <span className="text-xs font-bold text-sage">{t('common.perMonth')}</span>
        </p>
      </div>

      {listing.distanceKm !== undefined ? (
        <Tratta km={listing.distanceKm} university={listing.zone} className="mt-1.5" />
      ) : (
        listing.zone && (
          <p className="mt-1 truncate text-sm font-bold text-sage">
            {t('listingDetail.near')} {listing.zone}
          </p>
        )
      )}

      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold text-sage">
        {typeLabel && (
          <span className="inline-flex items-center gap-1.5">
            <TypeSwatch type={listing.propertyType} />
            {typeLabel}
          </span>
        )}
        <span className={cn('inline-flex items-center gap-1.5', listing.available ? 'text-shutter' : 'text-sage')}>
          {typeLabel && <span aria-hidden>·</span>}
          {listing.available ? t('common.availableNow') : t('common.notAvailable')}
        </span>
        {someBillsIncluded && (
          <span>
            <span aria-hidden>· </span>
            {t('common.someBillsIncluded')}
          </span>
        )}
      </p>
    </Link>
  );
}
