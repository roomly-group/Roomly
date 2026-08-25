import { useState } from 'react';
import {
  Bath,
  BedDouble,
  ChevronLeft,
  CircleCheck,
  Heart,
  LampDesk,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  Wifi,
  X,
} from 'lucide-react';
import { Link, useParams } from 'wouter';
import { getGetListingQueryKey, useGetListing } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { formatPrice, gradients } from '@/lib/constants';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { Button } from '@/components/shared/button';
import { QueryError } from '@/components/shared/query-error';

function Feature({ icon: Icon, label }: { icon: typeof BedDouble; label: string }) {
  return (
    <div className="rounded-xl bg-[#E1F5EE] p-3 text-center text-xs font-extrabold text-[#085041]">
      <Icon size={18} className="mx-auto mb-1.5 text-[#0F6E56]" />
      {label}
    </div>
  );
}

export function ListingDetail() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const listingId = Number(id);
  const { data: listing, isLoading, isError, refetch } = useGetListing(listingId, {
    query: { queryKey: getGetListingQueryKey(listingId) },
  });
  const [saved, setSaved] = useState(false);
  const [showContact, setShowContact] = useState(false);

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1120px] px-5 py-12">
          <div className="skeleton h-[380px] rounded-[2rem]" />
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="skeleton h-60 rounded-2xl" />
            <div className="skeleton h-60 rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (isError || !listing) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[800px] px-5 py-16">
          <QueryError onRetry={() => refetch()} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1120px] px-5 py-8 lg:px-8 lg:py-12">
        <Link
          href="/search"
          className="mb-6 inline-flex items-center gap-2 text-sm font-black text-[#0F6E56]"
          data-testid="link-back-search"
        >
          <ChevronLeft size={16} /> {t('listingDetail.allRooms')}
        </Link>

        <div
          className={`relative flex h-[280px] items-end overflow-hidden rounded-[2rem] bg-gradient-to-br ${gradients[listing.id % gradients.length]} p-6 sm:h-[390px] sm:p-9`}
        >
          <div className="absolute right-12 top-10 h-48 w-48 rounded-full border-[28px] border-[#F1EFE8]/35" />
          <div className="relative">
            <span className="rounded-lg bg-[#F1EFE8]/85 px-3 py-1.5 text-xs font-black text-[#085041]">
              {listing.available ? t('common.availableNow') : t('common.comingSoon')}
            </span>
            <h1 className="display-heading mt-3 max-w-xl text-4xl text-[#085041] sm:text-6xl">
              {listing.title}
            </h1>
            <p className="mt-3 flex items-center gap-1.5 text-sm font-extrabold text-[#265c4d]">
              <MapPin size={16} /> {listing.zone}
            </p>
          </div>
          <button
            onClick={() => setSaved(!saved)}
            className={`absolute right-5 top-5 rounded-full p-3 backdrop-blur ${
              saved ? 'bg-[#0F6E56] text-[#E1F5EE]' : 'bg-[#F1EFE8]/80 text-[#085041]'
            }`}
            data-testid="button-save-detail"
            aria-label={t('common.saveRoom')}
          >
            <Heart size={19} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-7 flex flex-wrap items-center gap-5 border-b border-[#d6e7de] pb-6">
              <div>
                <p className="text-2xl font-black text-[#0F6E56]">
                  {formatPrice(listing.price)}
                  <span className="text-sm font-bold text-[#527067]">{t('common.perMonth')}</span>
                </p>
              </div>
              <div className="h-8 w-px bg-[#c8ddd3]" />
              <div className="flex items-center gap-1.5 text-sm font-extrabold">
                <Star size={16} fill="#EF9F27" className="text-[#EF9F27]" /> {listing.rating.toFixed(1)}{' '}
                <span className="font-bold text-[#527067]">{t('listingDetail.ownerRating')}</span>
              </div>
            </div>

            <div>
              <p className="eyebrow mb-3">{t('listingDetail.aboutRoom')}</p>
              <p className="max-w-2xl whitespace-pre-line text-[15px] leading-7 text-[#527067]">
                {listing.description}
              </p>
            </div>

            <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              <Feature
                icon={BedDouble}
                label={listing.furnished ? t('common.furnished') : t('common.unfurnished')}
              />
              <Feature
                icon={Wifi}
                label={listing.wifi ? t('listingDetail.featureWifi') : t('listingDetail.featureNoWifi')}
              />
              <Feature icon={Bath} label={t('listingDetail.featureBathroom')} />
              <Feature icon={LampDesk} label={t('listingDetail.featureStudy')} />
            </div>
          </div>

          <aside className="surface h-fit rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <Avatar name={listing.owner} size="lg" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#527067]">
                  {t('listingDetail.yourHost')}
                </p>
                <h2 className="font-black text-[#085041]">{listing.owner}</h2>
                <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-[#527067]">
                  <CircleCheck size={13} className="text-[#0F6E56]" /> {t('listingDetail.identityChecked')}
                </p>
              </div>
            </div>

            <div className="my-5 border-t border-[#e1ebe4] pt-5">
              <p className="text-sm leading-6 text-[#527067]">{t('listingDetail.questionText')}</p>
              <Button
                className="mt-4 w-full"
                onClick={() => setShowContact(true)}
                data-testid="button-contact-owner"
              >
                <MessageCircle size={17} /> {t('listingDetail.message')} {listing.owner.split(' ')[0]}
              </Button>
            </div>

            <p className="flex items-start gap-2 text-xs leading-5 text-[#527067]">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#0F6E56]" />{' '}
              {t('listingDetail.keepConversation')}
            </p>
          </aside>
        </div>

        {showContact && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#085041]/35 p-4 sm:items-center">
            <div className="surface page-enter w-full max-w-md rounded-2xl p-6 shadow-[var(--shadow-lg)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="eyebrow">{t('listingDetail.modalSayHello')}</p>
                  <h2 className="mt-1 text-2xl font-black text-[#085041]">
                    {t('listingDetail.message')} {listing.owner.split(' ')[0]}
                  </h2>
                </div>
                <button
                  onClick={() => setShowContact(false)}
                  className="rounded-lg p-2 text-[#527067] hover:bg-[#E1F5EE]"
                  data-testid="button-close-contact"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#527067]">{t('listingDetail.modalInfo')}</p>
              <div className="mt-5 rounded-xl bg-[#E1F5EE] p-4 text-sm font-bold text-[#085041]">
                {t('listingDetail.modalTip')}
              </div>
              <Button onClick={() => setShowContact(false)} className="mt-5 w-full" data-testid="button-contact-done">
                {t('listingDetail.gotIt')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
