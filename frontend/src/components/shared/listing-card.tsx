import { ArrowRight, MapPin } from 'lucide-react';
import { Link } from 'wouter';
import type { Listing } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES, formatPrice, gradients, MAX_PAGE_ENTRY_DELAY_INDEX } from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Stable test selector prefixes for listing cards and their actions. */
const LISTING_CARD_TEST_IDS = {
  CARD_LISTING_PREFIX: 'card-listing-',
  LINK_VIEW_LISTING_PREFIX: 'link-view-listing-',
} as const;

export function ListingCard({
  listing,
  index = 0,
  isClickable = false,
}: {
  listing: Listing;
  index?: number;
  isClickable?: boolean;
}) {
  const { t } = useLanguage();
  // With a distance (search by university) the line reads "15.8 km from {searched
  // university}"; otherwise it just names the room's closest university.
  const locationLabel =
    listing.distanceKm !== undefined
      ? t('common.kmFromUniversity')
          .replace('{km}', listing.distanceKm.toFixed(1))
          .replace('{university}', listing.zone)
      : listing.zone;

  if (isClickable) {
    return (
      <Link href={`${APP_ROUTES.LISTINGS}/${listing.id}`}>
        <article
          className={`surface page-enter delay-${Math.min(index + 1, MAX_PAGE_ENTRY_DELAY_INDEX)} group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]`}
          data-testid={`${LISTING_CARD_TEST_IDS.CARD_LISTING_PREFIX}${listing.id}`}
        >
          <div
            className={`relative flex h-48 items-end bg-gradient-to-br ${gradients[index % gradients.length]} p-4`}
          >
            {listing.coverPhotoUrl && (
              <>
                <img src={listing.coverPhotoUrl} alt={listing.title} crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              </>
            )}
            <div className="relative flex w-full items-end justify-between">
              <span className="rounded-lg bg-[#F1EFE8]/85 px-2.5 py-1 text-xs font-black text-[#085041] backdrop-blur">
                {listing.available ? t('common.availableNow') : t('common.comingSoon')}
              </span>
              {listing.photos > 0 && (
                <span className="text-xs font-bold text-[#085041]/70">
                  {listing.photos} {t('common.photos')}
                </span>
              )}
            </div>
          </div>

          <div className="p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-extrabold text-[#527067]">
                  <MapPin size={13} /> {locationLabel}
                </p>
                <h3 className="line-clamp-1 text-lg font-black text-[#085041]">
                  {listing.title}
                </h3>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#e1ebe4] pt-3">
              <p className="text-lg font-black text-[#0F6E56]">
                {formatPrice(listing.price)}
                <span className="text-xs font-bold text-[#527067]">{t('common.perMonth')}</span>
              </p>
              <span
                className="flex items-center gap-1 text-sm font-black text-[#085041] hover:text-[#EF9F27]"
                data-testid={`${LISTING_CARD_TEST_IDS.LINK_VIEW_LISTING_PREFIX}${listing.id}`}
              >
                {t('common.viewRoom')}{' '}
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <article
      className={`surface page-enter delay-${Math.min(index + 1, MAX_PAGE_ENTRY_DELAY_INDEX)} group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]`}
      data-testid={`${LISTING_CARD_TEST_IDS.CARD_LISTING_PREFIX}${listing.id}`}
    >
      <div
        className={`relative flex h-48 items-end bg-gradient-to-br ${gradients[index % gradients.length]} p-4`}
      >
        {listing.coverPhotoUrl && (
          <>
            <img src={listing.coverPhotoUrl} alt={listing.title} crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          </>
        )}
        <div className="relative flex w-full items-end justify-between">
          <span className="rounded-lg bg-[#F1EFE8]/85 px-2.5 py-1 text-xs font-black text-[#085041] backdrop-blur">
            {listing.available ? t('common.availableNow') : t('common.comingSoon')}
          </span>
          {listing.photos > 0 && (
            <span className="text-xs font-bold text-[#085041]/70">
              {listing.photos} {t('common.photos')}
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-extrabold text-[#527067]">
              <MapPin size={13} /> {locationLabel}
            </p>
            <h3 className="line-clamp-1 text-lg font-black text-[#085041]">
              {listing.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#e1ebe4] pt-3">
          <p className="text-lg font-black text-[#0F6E56]">
            {formatPrice(listing.price)}
            <span className="text-xs font-bold text-[#527067]">{t('common.perMonth')}</span>
          </p>
          <Link
            href={`${APP_ROUTES.LISTINGS}/${listing.id}`}
            className="flex items-center gap-1 text-sm font-black text-[#085041] hover:text-[#EF9F27]"
            data-testid={`${LISTING_CARD_TEST_IDS.LINK_VIEW_LISTING_PREFIX}${listing.id}`}
          >
            {t('common.viewRoom')}{' '}
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}