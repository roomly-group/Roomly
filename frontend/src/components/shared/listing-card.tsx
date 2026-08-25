import { useState } from 'react';
import { ArrowRight, Heart, MapPin, Star } from 'lucide-react';
import { Link } from 'wouter';
import type { Listing } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { formatPrice, gradients } from '@/lib/constants';

export function ListingCard({
  listing,
  index = 0,
}: {
  listing: Listing;
  index?: number;
}) {
  const { t } = useLanguage();
  const [saved, setSaved] = useState(false);

  return (
    <article
      className={`surface page-enter delay-${Math.min(index + 1, 3)} group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]`}
      data-testid={`card-listing-${listing.id}`}
    >
      <div
        className={`relative flex h-48 items-end bg-gradient-to-br ${gradients[index % gradients.length]} p-4`}
      >
        <div className="absolute right-4 top-4 flex gap-2">
          <button
            onClick={() => setSaved(!saved)}
            className={`rounded-full p-2.5 backdrop-blur transition ${
              saved ? 'bg-[#0F6E56] text-[#E1F5EE]' : 'bg-[#F1EFE8]/75 text-[#085041] hover:bg-[#F1EFE8]'
            }`}
            aria-label={saved ? t('common.removeSavedRoom') : t('common.saveRoom')}
            data-testid={`button-save-listing-${listing.id}`}
          >
            <Heart size={17} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
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
              <MapPin size={13} /> {listing.zone}
            </p>
            <h3 className="line-clamp-1 text-lg font-black text-[#085041]">
              {listing.title}
            </h3>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-sm font-black text-[#2C2C2A]">
            <Star size={14} fill="#EF9F27" className="text-[#EF9F27]" />
            {listing.rating.toFixed(1)}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-[#e1ebe4] pt-3">
          <p className="text-lg font-black text-[#0F6E56]">
            {formatPrice(listing.price)}
            <span className="text-xs font-bold text-[#527067]">{t('common.perMonth')}</span>
          </p>
          <Link
            href={`/listings/${listing.id}`}
            className="flex items-center gap-1 text-sm font-black text-[#085041] hover:text-[#EF9F27]"
            data-testid={`link-view-listing-${listing.id}`}
          >
            {t('common.viewRoom')}{' '}
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
