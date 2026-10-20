import { GraduationCap, ImageOff } from 'lucide-react';
import { Link, useSearch } from 'wouter';
import type { Listing } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { useFormat } from '@/hooks/use-format';
import { APP_ROUTES } from '@/lib/constants';
import { RoomIllustration } from '@/components/shared/room-illustration';
import { cn } from '@/lib/utils';

// ===================== CONFIGURATION =====================

/** Stable test selector prefixes for listing cards. */
const LISTING_CARD_TEST_IDS = {
  CARD_LISTING_PREFIX: 'card-listing-',
} as const;

/** Room illustration shown for a listing without photos. */
export function ListingPhotoPlaceholder({
  id,
  className,
  showLabel = true,
}: {
  id: number;
  className?: string;
  showLabel?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className={cn('relative overflow-hidden bg-mint-mist', className)} data-placeholder-id={id}>
      <RoomIllustration className="absolute inset-0 !h-full w-full" />
      {showLabel && (
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-chip-veil px-2.5 py-1.5 text-xs font-black text-pine">
          <ImageOff size={13} aria-hidden /> {t('common.noPhotos')}
        </span>
      )}
    </div>
  );
}

/**
 * Frameless listing card: a 20:19 photo, then title, distance to the
 * university (the line that matters most), availability and monthly price.
 * The whole card is one link; nothing interactive is nested inside it.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const { t } = useLanguage();
  const format = useFormat();
  const search = useSearch();
  const someBillsIncluded = (listing.features?.spese_incluse?.length ?? 0) > 0;

  // The detail page gets the search it came from: its back link keeps the filters
  // and its distance is measured from the same university.
  const detailHref = `${APP_ROUTES.LISTINGS}/${listing.id}${search ? `?${new URLSearchParams({ from: search })}` : ''}`;

  // With a distance (search by university) the line reads "1,2 km from {searched
  // university}"; otherwise it just names the room's closest university.
  const universityLine =
    listing.distanceKm !== undefined
      ? t('common.kmFromUniversity')
          .replace('{km}', format.km(listing.distanceKm))
          .replace('{university}', listing.zone)
      : listing.zone;

  return (
    <Link
      href={detailHref}
      className="group block rounded-2xl"
      data-testid={`${LISTING_CARD_TEST_IDS.CARD_LISTING_PREFIX}${listing.id}`}
    >
      <div className="relative aspect-[20/19] overflow-hidden rounded-2xl bg-line transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-lift">
        {listing.coverPhotoUrl ? (
          <img
            src={listing.coverPhotoUrl}
            alt=""
            crossOrigin="anonymous"
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <ListingPhotoPlaceholder id={listing.id} className="h-full w-full" />
        )}
        {listing.photos > 1 && (
          <span className="absolute bottom-3 right-3 rounded-lg bg-chip-veil px-2 py-1 text-xs font-black tabular-nums text-pine">
            {listing.photos} {t('common.photos')}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-[3px]">
        <h3 className="line-clamp-1 text-base font-extrabold tracking-[-0.01em] text-pine">{listing.title}</h3>
        {universityLine && (
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-pine">
            <GraduationCap size={15} className="shrink-0 text-shutter" aria-hidden />
            <span className="line-clamp-1">{universityLine}</span>
          </p>
        )}
        <p className="flex items-center gap-1.5 text-xs font-extrabold text-sage">
          <span className={cn('h-1.5 w-1.5 rounded-full', listing.available ? 'bg-shutter' : 'bg-sage')} aria-hidden />
          {listing.available ? t('common.availableNow') : t('common.notAvailable')}
        </p>
        <p className="pt-1 text-sm text-sage">
          <span className="text-base font-black tabular-nums text-shutter">{format.price(listing.price)}</span>
          {t('common.perMonth')}
          {someBillsIncluded && <> · {t('common.someBillsIncluded')}</>}
        </p>
      </div>
    </Link>
  );
}
