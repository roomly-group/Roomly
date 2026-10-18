import { useEffect, useState } from 'react';
import {
  BedDouble,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Heart,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetListingQueryKey,
  getListConversationsQueryKey,
  useGetListing,
  useListConversations,
  useStartConversation,
} from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import {
  APP_ROUTES,
  formatPrice,
  gradients,
  LISTING_DETAIL_TEST_IDS,
  LISTING_FEATURE_GROUP_KEYS,
  LISTING_FURNITURE_GROUP,
} from '@/lib/constants';
import {
  LISTING_FEATURE_GROUP_ICONS,
  LISTING_PETS_ICON,
  LISTING_SMOKERS_ICON,
} from '@/components/shared/listing-features-fields';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { Button } from '@/components/shared/button';
import { QueryError } from '@/components/shared/query-error';
import { supabase } from '@/lib/supabase';
import { MESSAGE_MAX_LENGTH_CHARS } from '@workspace/api-zod';

function Feature({ icon: Icon, label }: { icon: typeof BedDouble; label: string }) {
  return (
    <div className="rounded-xl bg-[#E1F5EE] p-3 text-center text-xs font-extrabold text-[#085041]">
      <Icon size={18} className="mx-auto mb-1.5 text-[#0F6E56]" />
      {label}
    </div>
  );
}

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

export function ListingDetail() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const listingId = Number(id);
  const { data: listing, isLoading, isError, refetch } = useGetListing(listingId, {
    query: { queryKey: getGetListingQueryKey(listingId) },
  });
  const { data: conversations, isLoading: isLoadingConversations } = useListConversations({
    query: { queryKey: getListConversationsQueryKey() },
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [firstMessage, setFirstMessage] = useState('');
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const startConversation = useStartConversation();

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setCurrentUserId(data.session?.user.id ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  // Il proprietario non può inviare richieste al proprio annuncio.
  const isOwnListing = Boolean(currentUserId && listing?.ownerId && listing.ownerId === currentUserId);

  const existingListingConversation = conversations?.find(
    (conv) =>
      conv.role === 'student' &&
      conv.roomId === listingId
  );
  const acceptedConversation = conversations?.find(
    (conv) => conv.role === 'student' && conv.requestStatus === 'accettata',
  );

  const getStartConversationErrorMessage = () => {
    const error: unknown = startConversation.error;
    if (typeof error !== 'object' || error === null || !('status' in error)) {
      return t('messages.sendError');
    }

    const status = error.status;
    const data = 'data' in error ? error.data : undefined;
    const backendError =
      typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
        ? data.error
        : '';

    if (status === 409) {
      if (backendError === 'Student already has an accepted chat') {
        return t('listingDetail.alreadyHaveRoom');
      }
      if (backendError === 'Too many pending requests for this room') {
        return t('listingDetail.tooManyRequests');
      }
      if (backendError === 'Room not available') {
        return t('listingDetail.roomUnavailable');
      }
    }
    if (status === 404 && backendError === 'Listing not found') {
      return t('listingDetail.roomUnavailable');
    }
    if (status === 400 && backendError === 'Non puoi scrivere a te stesso') {
      return t('listingDetail.cannotMessageSelf');
    }
    return t('messages.sendError');
  };
  const photoUrls = listing?.photoUrls?.length
    ? listing.photoUrls
    : listing?.coverPhotoUrl
      ? [listing.coverPhotoUrl]
      : [];
  const photoCount = photoUrls.length;

  useEffect(() => {
    if (selectedPhotoIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPhotoIndex(null);
      if (photoCount < 2) return;
      if (event.key === 'ArrowRight') {
        setSelectedPhotoIndex((current) => current === null ? null : (current + 1) % photoCount);
      }
      if (event.key === 'ArrowLeft') {
        setSelectedPhotoIndex((current) => current === null ? null : (current - 1 + photoCount) % photoCount);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [photoCount, selectedPhotoIndex]);

  const sendFirstMessage = (event: React.FormEvent) => {
    event.preventDefault();
    const body = firstMessage.trim();
    if (!body || startConversation.isPending || isOwnListing) return;
    startConversation.mutate(
      { data: { listingId, body } },
      {
        onSuccess: (returnedConversations) => {
          const returnedConversation = returnedConversations[0];
          if (!returnedConversation) return;
          void client.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          void client.invalidateQueries({ queryKey: getGetListingQueryKey(listingId) });
          setShowContact(false);
          setFirstMessage('');
          navigate(`${APP_ROUTES.MESSAGES}/${returnedConversation.id}`);
        },
      },
    );
  };

  const closeContact = () => {
    setShowContact(false);
    startConversation.reset();
  };

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
          href={APP_ROUTES.SEARCH}
          className="mb-6 inline-flex items-center gap-2 text-sm font-black text-[#0F6E56]"
          data-testid={LISTING_DETAIL_TEST_IDS.LINK_BACK_SEARCH}
        >
          <ChevronLeft size={16} /> {t('listingDetail.allRooms')}
        </Link>

        <div
          className={`relative flex h-[280px] items-end overflow-hidden rounded-[2rem] bg-gradient-to-br ${gradients[listing.id % gradients.length]} p-6 sm:h-[390px] sm:p-9`}
        >
          {listing.coverPhotoUrl && (
            <>
              <button
                type="button"
                onClick={() => setSelectedPhotoIndex(Math.max(0, photoUrls.indexOf(listing.coverPhotoUrl!)))}
                aria-label="View cover photo full screen"
                className="absolute inset-0 z-0 cursor-zoom-in"
                data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_LISTING_COVER_PHOTO}
              >
                <img src={listing.coverPhotoUrl} alt={listing.title} crossOrigin="anonymous" className="h-full w-full object-cover" />
              </button>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            </>
          )}
          <div className="relative z-10">
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
            className={`absolute right-5 top-5 z-20 rounded-full p-3 backdrop-blur ${
              saved ? 'bg-[#0F6E56] text-[#E1F5EE]' : 'bg-[#F1EFE8]/80 text-[#085041]'
            }`}
            data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_SAVE_DETAIL}
            aria-label={t('common.saveRoom')}
          >
            <Heart size={19} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>

        {photoUrls.length > 0 && (
          <div
            className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3"
            aria-label={`${listing.title} photos`}
            data-testid={LISTING_DETAIL_TEST_IDS.GALLERY_LISTING_PHOTOS}
          >
            {photoUrls.map((photoUrl, index) => (
              <button
                key={photoUrl}
                type="button"
                onClick={() => setSelectedPhotoIndex(index)}
                aria-label={`View photo ${index + 1} full screen`}
                className="group relative aspect-[4/3] w-[82vw] max-w-[360px] shrink-0 snap-start overflow-hidden rounded-xl bg-[#e1ebe4] sm:w-[320px]"
                data-testid={`${LISTING_DETAIL_TEST_IDS.BUTTON_LISTING_PHOTO_PREFIX}${index + 1}`}
              >
                <img
                  src={photoUrl}
                  alt={`${listing.title} ${index + 1}`}
                  crossOrigin="anonymous"
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
              </button>
            ))}
          </div>
        )}

        {selectedPhotoIndex !== null && photoUrls[selectedPhotoIndex] && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${listing.title} photo ${selectedPhotoIndex + 1} of ${photoCount}`}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-4 sm:p-8"
            onClick={(event) => {
              if (event.target === event.currentTarget) setSelectedPhotoIndex(null);
            }}
            data-testid={LISTING_DETAIL_TEST_IDS.LIGHTBOX_LISTING_PHOTO}
          >
            <button
              type="button"
              onClick={() => setSelectedPhotoIndex(null)}
              aria-label="Close full-screen photo"
              title="Close"
              className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
              data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_CLOSE_PHOTO_LIGHTBOX}
            >
              <X size={22} />
            </button>

            {photoCount > 1 && (
              <button
                type="button"
                onClick={() => setSelectedPhotoIndex((selectedPhotoIndex - 1 + photoCount) % photoCount)}
                aria-label="Previous photo"
                title="Previous photo"
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:left-6"
                data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_PREVIOUS_PHOTO}
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <figure className="flex max-h-full max-w-full flex-col items-center gap-3">
              <img
                src={photoUrls[selectedPhotoIndex]}
                alt={`${listing.title} ${selectedPhotoIndex + 1}`}
                crossOrigin="anonymous"
                className="max-h-[calc(100dvh-7rem)] max-w-[calc(100vw-2rem)] object-contain sm:max-w-[calc(100vw-8rem)]"
                data-testid={LISTING_DETAIL_TEST_IDS.IMAGE_PHOTO_LIGHTBOX_FULL}
              />
              <figcaption className="text-sm font-bold text-white/80">
                {selectedPhotoIndex + 1} / {photoCount}
              </figcaption>
            </figure>

            {photoCount > 1 && (
              <button
                type="button"
                onClick={() => setSelectedPhotoIndex((selectedPhotoIndex + 1) % photoCount)}
                aria-label="Next photo"
                title="Next photo"
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:right-6"
                data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_NEXT_PHOTO}
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>
        )}

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

            {/* Tipologia, taglio and house rules (tipologia_proprieta, taglio_appartamento, animali_consentiti, fumatori_consentiti). */}
            <div className="mt-8">
              <p className="eyebrow mb-3">{t('listingDetail.roomRules')}</p>
              <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
                {listing.propertyType && (
                  <Feature icon={Building2} label={t(`propertyType.${listing.propertyType}` as TranslationKey)} />
                )}
                {listing.apartmentLayout && (
                  <Feature icon={BedDouble} label={t(`apartmentLayout.${listing.apartmentLayout}` as TranslationKey)} />
                )}
                <Feature
                  icon={LISTING_PETS_ICON}
                  label={t(listing.petsAllowed ? 'newListing.petsAllowed' : 'listingDetail.petsNotAllowed')}
                />
                <Feature
                  icon={LISTING_SMOKERS_ICON}
                  label={t(listing.smokersAllowed ? 'newListing.smokersAllowed' : 'listingDetail.smokersNotAllowed')}
                />
              </div>
            </div>

            {/* Features grouped by type, like the columns of `stanze`; empty groups are hidden. */}
            {LISTING_FEATURE_GROUP_KEYS.map((group) => {
              const items = listing.features?.[group] ?? [];
              const furnishedOnly = group === LISTING_FURNITURE_GROUP && listing.furnished && items.length === 0;
              if (items.length === 0 && !furnishedOnly) return null;
              const Icon = LISTING_FEATURE_GROUP_ICONS[group];
              return (
                <div key={group} className="mt-8">
                  <p className="eyebrow mb-3">{t(`newListing.group.${group}` as TranslationKey)}</p>
                  <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
                    {furnishedOnly ? (
                      <Feature icon={Icon} label={t('common.furnished')} />
                    ) : (
                      items.map((item) => (
                        <Feature key={item} icon={Icon} label={t(`newListing.feature.${item}` as TranslationKey)} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
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
              {acceptedConversation && (
                <>
                  <p className="mt-2 text-sm font-bold text-[#0F6E56]">
                    {t('listingDetail.alreadyHaveRoom')}
                  </p>
                  <Link
                    href={`${APP_ROUTES.MESSAGES}/${acceptedConversation.id}`}
                    className="mt-2 block text-sm font-medium text-[#0F6E56] hover:underline"
                    data-testid={LISTING_DETAIL_TEST_IDS.LINK_ACCEPTED_CHAT}
                  >
                    {t('listingDetail.goToChat')}
                  </Link>
                </>
              )}
              {!listing.available && (
                <p className="mt-2 text-sm font-bold text-[#a74b32]">
                  {t('listingDetail.roomUnavailable')}
                </p>
              )}
              {existingListingConversation && !acceptedConversation && (
                <Link
                  href={`${APP_ROUTES.MESSAGES}/${existingListingConversation.id}`}
                  className="mt-4 block text-sm font-bold text-[#0F6E56] hover:underline"
                  data-testid={LISTING_DETAIL_TEST_IDS.LINK_EXISTING_CHAT}
                >
                  {t('listingDetail.openExistingChat')}
                </Link>
              )}
              {isOwnListing && (
                <p className="mt-4 text-sm font-bold text-[#527067]" data-testid={LISTING_DETAIL_TEST_IDS.STATUS_OWN_LISTING}>
                  {t('listingDetail.cannotMessageSelf')}
                </p>
              )}
              {!isOwnListing && !existingListingConversation && !acceptedConversation && listing.available && (
                <button
                  type="button"
                  onClick={() => setShowContact(true)}
                  aria-label={t('listingDetail.contactOwner')}
                  title={t('listingDetail.contactOwner')}
                  data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_CONTACT_OWNER}
                  disabled={startConversation.isPending || isLoadingConversations}
                  className="mt-4 h-12 w-full min-w-[80px] shrink-0 rounded-xl bg-[#EF9F27] px-4 font-extrabold text-[#2C2C2A] transition-all duration-200 hover:bg-[#e6a53d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('listingDetail.contactOwner')}
                </button>
              )}
              {!isOwnListing && !listing.available && !existingListingConversation && !acceptedConversation && (
                <button
                  type="button"
                  disabled
                  aria-label={t('listingDetail.contactOwner')}
                  data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_CONTACT_OWNER}
                  className="mt-4 h-12 w-full rounded-xl bg-[#EF9F27] px-4 font-extrabold text-[#2C2C2A] opacity-50"
                >
                  {t('listingDetail.contactOwner')}
                </button>
              )}
            </div>

            <p className="flex items-start gap-2 text-xs leading-5 text-[#527067]">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#0F6E56]" />{' '}
              {t('listingDetail.keepConversation')}
            </p>
          </aside>
        </div>

        {showContact && !isOwnListing && (
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
                  onClick={closeContact}
                  className="rounded-lg p-2 text-[#527067] hover:bg-[#E1F5EE]"
                  data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_CLOSE_CONTACT}
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={sendFirstMessage}>
                <p className="mt-3 text-sm leading-6 text-[#527067]">
                  {t('listingDetail.modalInfoRequest')}
                </p>
                <div className="mt-4 rounded-xl bg-[#E1F5EE] p-3 text-xs font-bold text-[#085041]">
                  {t('listingDetail.modalTip')}
                </div>
                <textarea
                  value={firstMessage}
                  onChange={(event) => setFirstMessage(event.target.value)}
                  rows={4}
                  maxLength={MESSAGE_MAX_LENGTH_CHARS}
                  autoFocus
                  placeholder={t('listingDetail.firstMessagePlaceholder')}
                  className="mt-4 w-full resize-none rounded-xl border border-[#c8ddd2] bg-[#F1EFE8] p-3 text-sm outline-none placeholder:text-[#82978e] focus:border-[#0F6E56]"
                  data-testid={LISTING_DETAIL_TEST_IDS.INPUT_FIRST_MESSAGE}
                />
                {startConversation.isError && (
                  <p className="mt-2 text-xs font-bold text-[#a74b32]" data-testid={LISTING_DETAIL_TEST_IDS.STATUS_CONTACT_ERROR}>
                    {getStartConversationErrorMessage()}
                  </p>
                )}
                <Button
                  type="submit"
                  className="mt-4 w-full"
                  disabled={!firstMessage.trim() || startConversation.isPending}
                  data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_CONTACT_SEND}
                >
                  <Send size={16} /> {t('listingDetail.sendMessage')}
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}