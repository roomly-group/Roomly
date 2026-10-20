import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  BedDouble,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  GraduationCap,
  Images,
  MessageCircle,
  PenLine,
  Send,
  Share2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetListingQueryKey,
  getListConversationsQueryKey,
  getListListingsQueryKey,
  useGetListing,
  useListListings,
  useListConversations,
  useStartConversation,
} from '@workspace/api-client-react';
import type { Listing } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { useFormat } from '@/hooks/use-format';
import { useToast } from '@/hooks/use-toast';
import {
  APP_ROUTES,
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
import { ListingPhotoPlaceholder } from '@/components/shared/listing-card';
import { QueryError } from '@/components/shared/query-error';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { MESSAGE_MAX_LENGTH_CHARS } from '@workspace/api-zod';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Photos shown in the desktop mosaic (one large + four small). */
const MOSAIC_PHOTO_COUNT = 5 as const;
/** Extra selectors for the redesigned detail page. */
const DETAIL_TEST_IDS = {
  BUTTON_SHARE: 'button-share-listing',
  BUTTON_SHOW_ALL_PHOTOS: 'button-show-all-photos',
  CARD_DISTANCE: 'card-listing-distance',
  CARD_REQUEST: 'card-listing-request',
  BAR_MOBILE_REQUEST: 'bar-mobile-request',
  LINK_EDIT_OWN: 'link-edit-own-listing',
  LINK_SIMILAR: 'link-similar-rooms',
} as const;

const SECTION_TITLE_CLASS = 'text-[22px] font-black leading-[1.1] tracking-[-0.04em] text-pine';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section data-reveal className="border-t border-line pt-8">
      <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FactRow({ icon: Icon, children }: { icon: typeof BedDouble; children: React.ReactNode }) {
  return (
    <li className="flex min-h-[64px] items-center gap-3 rounded-xl border border-pine/10 bg-paper px-4 py-3 text-sm font-bold text-ink">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint-mist text-shutter" aria-hidden>
        <Icon size={18} strokeWidth={1.9} />
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** Desktop: one large photo plus up to four small ones. Phones: a swipeable strip. */
function PhotoMosaic({
  listing,
  photoUrls,
  onOpen,
}: {
  listing: Listing;
  photoUrls: string[];
  onOpen: (index: number) => void;
}) {
  const { t } = useLanguage();
  const count = photoUrls.length;

  if (count === 0) {
    return <ListingPhotoPlaceholder id={listing.id} className="aspect-[16/9] rounded-2xl sm:aspect-[21/9]" />;
  }

  const mosaic = photoUrls.slice(0, MOSAIC_PHOTO_COUNT);
  const small = mosaic.slice(1);
  const photoLabel = (index: number) =>
    t('listingDetail.openPhoto').replace('{n}', String(index + 1)).replace('{total}', String(count));

  return (
    <div className="relative">
      {/* Phones: swipe through every photo. */}
      <div
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 sm:hidden"
        aria-label={t('listingDetail.photosOf').replace('{title}', listing.title)}
        data-testid={LISTING_DETAIL_TEST_IDS.GALLERY_LISTING_PHOTOS}
      >
        {photoUrls.map((url, index) => (
          <button
            key={url}
            type="button"
            onClick={() => onOpen(index)}
            aria-label={photoLabel(index)}
            className="relative aspect-[4/3] w-[86vw] shrink-0 snap-center overflow-hidden rounded-2xl bg-line"
            data-testid={`${LISTING_DETAIL_TEST_IDS.BUTTON_LISTING_PHOTO_PREFIX}${index + 1}`}
          >
            <img src={url} alt="" crossOrigin="anonymous" loading={index ? 'lazy' : 'eager'} className="h-full w-full object-cover" />
            <span className="absolute bottom-3 right-3 rounded-lg bg-chip-veil px-2 py-1 text-xs font-black tabular-nums text-pine">
              {index + 1} / {count}
            </span>
          </button>
        ))}
      </div>

      {/* From 640px: the mosaic. */}
      <div
        className={cn(
          'hidden h-[clamp(300px,42vw,460px)] gap-2 overflow-hidden rounded-2xl sm:grid',
          small.length === 0 && 'grid-cols-1',
          small.length === 1 && 'grid-cols-2',
          small.length >= 2 && 'grid-cols-4 grid-rows-2',
        )}
      >
        {mosaic.map((url, index) => (
          <button
            key={url}
            type="button"
            onClick={() => onOpen(index)}
            aria-label={photoLabel(index)}
            className={cn(
              'group relative overflow-hidden bg-line',
              index === 0 && small.length >= 2 && 'col-span-2 row-span-2',
              index > 0 && small.length === 2 && 'col-span-2',
              index > 0 && small.length === 3 && index === 3 && 'col-span-2',
            )}
            data-testid={index === 0 ? LISTING_DETAIL_TEST_IDS.BUTTON_LISTING_COVER_PHOTO : undefined}
          >
            <img
              src={url}
              alt=""
              crossOrigin="anonymous"
              className="h-full w-full object-cover transition-[filter] duration-200 group-hover:brightness-95"
            />
          </button>
        ))}
      </div>

      {count > 1 && (
        <button
          type="button"
          onClick={() => onOpen(0)}
          className="absolute bottom-4 right-4 hidden min-h-11 items-center gap-2 rounded-xl border border-pine/15 bg-paper px-4 text-sm font-extrabold text-pine shadow-rest transition-colors hover:bg-cream sm:inline-flex"
          data-testid={DETAIL_TEST_IDS.BUTTON_SHOW_ALL_PHOTOS}
        >
          <Images size={16} aria-hidden /> {t('listingDetail.showAllPhotos')}
        </button>
      )}
    </div>
  );
}

export function ListingDetail() {
  const { t } = useLanguage();
  const format = useFormat();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const listingId = Number(id);
  const search = useSearch();
  const { data: listing, isLoading, isError, refetch } = useGetListing(listingId, {
    query: { queryKey: getGetListingQueryKey(listingId) },
  });
  const { data: conversations, isLoading: isLoadingConversations } = useListConversations({
    query: { queryKey: getListConversationsQueryKey() },
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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

  // The search this page was opened from, for the back link and the university to measure from.
  const fromSearch = new URLSearchParams(search).get('from') ?? '';
  const searchedUniversity = new URLSearchParams(fromSearch).get('zone') ?? '';
  const backHref = `${APP_ROUTES.SEARCH}${fromSearch ? `?${fromSearch}` : ''}`;

  // The listing endpoint has no distance, so it comes from the backend's university
  // search: to the university the student searched, or else to the room's nearest one.
  const distanceUniversity = searchedUniversity || listing?.zone || '';
  const distanceRequest = { zone: distanceUniversity };
  const { data: nearbyListings } = useListListings(distanceRequest, {
    query: { queryKey: getListListingsQueryKey(distanceRequest), enabled: Boolean(distanceUniversity) },
  });
  const distanceKm = nearbyListings?.find((item) => item.id === listingId)?.distanceKm ?? null;

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
  const canRequest = Boolean(listing?.available) && !isOwnListing && !existingListingConversation && !acceptedConversation;

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

  const setContactOpen = (open: boolean) => {
    setShowContact(open);
    if (!open) startConversation.reset();
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing?.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: t('listingDetail.linkCopied') });
    } catch {
      // The person closed the share sheet: nothing to report.
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1120px] px-5 py-10 lg:px-8" aria-hidden>
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton mt-4 h-10 w-2/3 rounded-lg" />
          <div className="skeleton mt-6 h-[clamp(300px,42vw,460px)] rounded-2xl" />
          <div className="mt-10 flex flex-wrap gap-16">
            <div className="skeleton h-60 min-w-0 flex-[999_1_520px] rounded-2xl" />
            <div className="skeleton h-72 w-full rounded-2xl laptop:w-[340px]" />
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

  const typeLine = [
    listing.propertyType ? t(`propertyType.${listing.propertyType}` as TranslationKey) : '',
    listing.apartmentLayout ? t(`apartmentLayout.${listing.apartmentLayout}` as TranslationKey) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const billItems = listing.features?.spese_incluse ?? [];
  const featureItems = LISTING_FEATURE_GROUP_KEYS.filter((group) => group !== 'spese_incluse').flatMap((group) => {
    const items = listing.features?.[group] ?? [];
    const Icon = LISTING_FEATURE_GROUP_ICONS[group];
    if (group === LISTING_FURNITURE_GROUP && listing.furnished && items.length === 0) {
      return [{ key: 'furnished', icon: Icon, label: t('common.furnished') }];
    }
    return items.map((item) => ({ key: `${group}-${item}`, icon: Icon, label: t(`newListing.feature.${item}` as TranslationKey) }));
  });
  const ownerFirstName = listing.owner.split(' ')[0];
  const editHref = APP_ROUTES.OWNER_LISTING_EDIT.replace(':id', String(listing.id));
  const similarHref = `${APP_ROUTES.SEARCH}?zone=${encodeURIComponent(listing.zone)}`;

  // What the request card says in each state; the amber button only when a request is possible.
  const requestState = isOwnListing ? (
    <div data-testid={LISTING_DETAIL_TEST_IDS.STATUS_OWN_LISTING}>
      <p className="text-sm font-bold text-ink">{t('listingDetail.yourListing')}</p>
      <Link
        href={editHref}
        className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mint-mist text-sm font-extrabold text-pine transition-colors hover:bg-mint-wash"
        data-testid={DETAIL_TEST_IDS.LINK_EDIT_OWN}
      >
        <PenLine size={16} aria-hidden /> {t('dashboard.editListing')}
      </Link>
    </div>
  ) : acceptedConversation ? (
    <div>
      <p className="text-sm leading-6 text-ink">{t('listingDetail.alreadyHaveRoom')}</p>
      <Link
        href={`${APP_ROUTES.MESSAGES}/${acceptedConversation.id}`}
        className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mint-mist text-sm font-extrabold text-pine transition-colors hover:bg-mint-wash"
        data-testid={LISTING_DETAIL_TEST_IDS.LINK_ACCEPTED_CHAT}
      >
        <MessageCircle size={16} aria-hidden /> {t('listingDetail.goToChat')}
      </Link>
    </div>
  ) : existingListingConversation ? (
    <div>
      <p className="text-sm leading-6 text-ink">{t('listingDetail.alreadyRequested')}</p>
      <Link
        href={`${APP_ROUTES.MESSAGES}/${existingListingConversation.id}`}
        className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mint-mist text-sm font-extrabold text-pine transition-colors hover:bg-mint-wash"
        data-testid={LISTING_DETAIL_TEST_IDS.LINK_EXISTING_CHAT}
      >
        <MessageCircle size={16} aria-hidden /> {t('listingDetail.goToChat')}
      </Link>
    </div>
  ) : !listing.available ? (
    <div>
      <p className="text-sm font-bold text-sage">{t('listingDetail.roomUnavailable')}</p>
      <Link
        href={similarHref}
        className="mt-3 flex min-h-12 items-center justify-center rounded-xl border border-outline text-sm font-extrabold text-pine transition-colors hover:border-shutter hover:bg-mint-mist"
        data-testid={DETAIL_TEST_IDS.LINK_SIMILAR}
      >
        {t('listingDetail.similarRooms')}
      </Link>
    </div>
  ) : (
    <div>
      <button
        type="button"
        onClick={() => setContactOpen(true)}
        disabled={startConversation.isPending || isLoadingConversations}
        className="hidden h-[52px] w-full items-center justify-center rounded-xl bg-sun text-[15px] font-black text-ink transition-[background-color,transform] duration-200 hover:bg-sun-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 laptop:flex"
        data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_CONTACT_OWNER}
      >
        {t('listingDetail.requestRoom')}
      </button>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-sage laptop:mt-5">{t('listingDetail.stepsTitle')}</p>
      <ol className="mt-3 space-y-3">
        {(['listingDetail.step1', 'listingDetail.step2', 'listingDetail.step3'] as const).map((key, index) => (
          <li key={key} className="flex gap-3 text-sm leading-5 text-ink">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint-mist text-xs font-black tabular-nums text-pine" aria-hidden>
              {index + 1}
            </span>
            {t(key)}
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-xl bg-cream px-3 py-2.5 text-xs font-bold leading-5 text-sage">{t('listingDetail.limitNote')}</p>
    </div>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-[1120px] px-5 pb-16 pt-6 lg:px-8 lg:pt-8">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-black text-shutter transition-colors hover:text-pine"
          data-testid={LISTING_DETAIL_TEST_IDS.LINK_BACK_SEARCH}
        >
          <ChevronLeft size={16} aria-hidden /> {t('listingDetail.allRooms')}
        </Link>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {typeLine && <p className="mb-2 text-[15px] font-bold text-sage">{typeLine}</p>}
            <h1 className="display-heading max-w-3xl break-words text-[clamp(2.25rem,5vw,2.75rem)] text-pine">{listing.title}</h1>
          </div>
          <button
            type="button"
            onClick={() => void share()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-extrabold text-ink underline decoration-outline underline-offset-4 transition-colors hover:bg-mint-mist"
            data-testid={DETAIL_TEST_IDS.BUTTON_SHARE}
          >
            <Share2 size={16} aria-hidden /> {t('listingDetail.share')}
          </button>
        </div>

        <div className="mt-6">
          <PhotoMosaic listing={listing} photoUrls={photoUrls} onOpen={setSelectedPhotoIndex} />
        </div>

        {selectedPhotoIndex !== null && photoUrls[selectedPhotoIndex] && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('listingDetail.openPhoto').replace('{n}', String(selectedPhotoIndex + 1)).replace('{total}', String(photoCount))}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/95 p-4 sm:p-8"
            onClick={(event) => {
              if (event.target === event.currentTarget) setSelectedPhotoIndex(null);
            }}
            data-testid={LISTING_DETAIL_TEST_IDS.LIGHTBOX_LISTING_PHOTO}
          >
            <button
              type="button"
              onClick={() => setSelectedPhotoIndex(null)}
              aria-label={t('searchBar.close')}
              className="on-dark absolute right-4 top-4 z-10 grid h-12 w-12 place-items-center rounded-full bg-paper/10 text-paper transition hover:bg-paper/20"
              data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_CLOSE_PHOTO_LIGHTBOX}
            >
              <X size={22} />
            </button>

            {photoCount > 1 && (
              <button
                type="button"
                onClick={() => setSelectedPhotoIndex((selectedPhotoIndex - 1 + photoCount) % photoCount)}
                aria-label={t('listingDetail.previousPhoto')}
                className="absolute left-3 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-paper/10 text-paper transition hover:bg-paper/20 sm:left-6"
                data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_PREVIOUS_PHOTO}
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <figure className="flex max-h-full max-w-full flex-col items-center gap-3">
              <img
                src={photoUrls[selectedPhotoIndex]}
                alt=""
                crossOrigin="anonymous"
                className="max-h-[calc(100dvh-7rem)] max-w-[calc(100vw-2rem)] rounded-lg object-contain sm:max-w-[calc(100vw-8rem)]"
                data-testid={LISTING_DETAIL_TEST_IDS.IMAGE_PHOTO_LIGHTBOX_FULL}
              />
              <figcaption className="text-sm font-bold tabular-nums text-paper/80">
                {selectedPhotoIndex + 1} / {photoCount}
              </figcaption>
            </figure>

            {photoCount > 1 && (
              <button
                type="button"
                onClick={() => setSelectedPhotoIndex((selectedPhotoIndex + 1) % photoCount)}
                aria-label={t('listingDetail.nextPhoto')}
                className="absolute right-3 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-paper/10 text-paper transition hover:bg-paper/20 sm:right-6"
                data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_NEXT_PHOTO}
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-start gap-x-16 gap-y-10">
          <div className="min-w-0 flex-[999_1_520px] space-y-10">
            <div
              className="inline-flex max-w-full items-center gap-3 rounded-full border border-pine/10 bg-paper py-2 pl-2 pr-5 shadow-rest"
              data-testid={DETAIL_TEST_IDS.CARD_DISTANCE}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mint-mist text-shutter" aria-hidden>
                <GraduationCap size={19} strokeWidth={1.9} />
              </span>
              {distanceKm !== null ? (
                <p className="min-w-0 truncate text-sm font-bold text-sage">
                  <span className="mr-1.5 text-xl font-black tabular-nums text-pine">{format.km(distanceKm)} km</span>
                  {t('listingDetail.distanceFrom').replace('{university}', distanceUniversity)}
                </p>
              ) : (
                <p className="min-w-0 truncate text-sm font-bold text-sage">
                  {t('listingDetail.near')} <span className="font-black text-pine">{listing.zone}</span>
                </p>
              )}
            </div>

            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {typeLine && <FactRow icon={Building2}>{typeLine}</FactRow>}
              <FactRow icon={LISTING_FEATURE_GROUP_ICONS[LISTING_FURNITURE_GROUP]}>
                {listing.furnished ? t('common.furnished') : t('common.unfurnished')}
              </FactRow>
              <FactRow icon={LISTING_FEATURE_GROUP_ICONS.spese_incluse}>
                {billItems.length
                  ? `${t('filters.bills')}: ${billItems.map((item) => t(`newListing.feature.${item}` as TranslationKey)).join(', ')}`
                  : t('listingDetail.billsNotIncluded')}
              </FactRow>
              <FactRow icon={CircleCheck}>{listing.available ? t('common.availableNow') : t('common.notAvailable')}</FactRow>
            </ul>

            {listing.description && (
              <Section title={t('listingDetail.aboutRoom')}>
                <p className="max-w-2xl whitespace-pre-line text-[15px] leading-7 text-ink">{listing.description}</p>
              </Section>
            )}

            {featureItems.length > 0 && (
              <Section title={t('listingDetail.whatYouGet')}>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {featureItems.map((item) => (
                    <FactRow key={item.key} icon={item.icon}>
                      {item.label}
                    </FactRow>
                  ))}
                </ul>
              </Section>
            )}

            <Section title={t('listingDetail.houseRules')}>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <FactRow icon={LISTING_PETS_ICON}>
                  {t(listing.petsAllowed ? 'newListing.petsAllowed' : 'listingDetail.petsNotAllowed')}
                </FactRow>
                <FactRow icon={LISTING_SMOKERS_ICON}>
                  {t(listing.smokersAllowed ? 'newListing.smokersAllowed' : 'listingDetail.smokersNotAllowed')}
                </FactRow>
              </ul>
            </Section>

          </div>

          <div className="w-full space-y-4 laptop:sticky laptop:top-[104px] laptop:w-[340px]">
          <aside
            className="rounded-2xl border border-pine/10 bg-paper p-6 shadow-lift"
            data-testid={DETAIL_TEST_IDS.CARD_REQUEST}
          >
            <p className="flex items-baseline gap-1">
              <span className="text-[28px] font-black tracking-[-0.03em] tabular-nums text-pine">{format.price(listing.price)}</span>
              <span className="text-sm font-bold text-sage">{t('common.perMonth')}</span>
            </p>
            {billItems.length > 0 && (
              <span className="mt-2 inline-flex rounded-full bg-mint-mist px-3 py-1 text-xs font-black text-pine">
                {t('common.someBillsIncluded')}
              </span>
            )}

            <div className="mt-5">{requestState}</div>

            <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-sage">{t('listingDetail.rent')}</dt>
                <dd className="font-extrabold tabular-nums text-ink">{format.price(listing.price)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-sage">{t('filters.bills')}</dt>
                <dd className="text-right font-extrabold text-ink">
                  {billItems.length
                    ? billItems.map((item) => t(`newListing.feature.${item}` as TranslationKey)).join(', ')
                    : t('listingDetail.none')}
                </dd>
              </div>
            </dl>
          </aside>
          <section aria-label={t('listingDetail.ownerLabel')}>
            <div className="flex items-center gap-4 rounded-2xl border border-pine/10 bg-paper p-5">
                <Avatar name={listing.owner} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-pine">{listing.owner}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-sage">
                    <CircleCheck size={14} className="text-shutter" aria-hidden /> {t('listingDetail.identityChecked')}
                  </p>
                </div>
              </div>
              <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-sage">
                <ShieldCheck size={16} className="mt-1 shrink-0 text-shutter" aria-hidden /> {t('listingDetail.keepConversation')}
              </p>
          </section>
          </div>
        </div>
      </div>

      {/* Phones and tablets: the request lives on the bottom edge. */}
      <div aria-hidden className="h-[calc(80px+env(safe-area-inset-bottom))] laptop:hidden" />
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] laptop:hidden"
        data-testid={DETAIL_TEST_IDS.BAR_MOBILE_REQUEST}
      >
        <div className="mx-auto flex h-20 max-w-[1120px] items-center justify-between gap-4 px-5">
          <p className="min-w-0">
            <span className="block text-lg font-black tabular-nums text-pine">
              {format.price(listing.price)}
              <span className="text-sm font-bold text-sage">{t('common.perMonth')}</span>
            </span>
            <span className="block truncate text-xs font-bold text-sage">
              {listing.available ? t('common.availableNow') : t('common.notAvailable')}
            </span>
          </p>
          {canRequest ? (
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              disabled={startConversation.isPending || isLoadingConversations}
              className="h-12 shrink-0 rounded-xl bg-sun px-6 text-[15px] font-black text-ink transition-colors hover:bg-sun-hover disabled:opacity-50"
            >
              {t('listingDetail.requestShort')}
            </button>
          ) : isOwnListing ? (
            <Link href={editHref} className="flex h-12 shrink-0 items-center rounded-xl bg-mint-mist px-5 text-sm font-extrabold text-pine">
              {t('dashboard.editListing')}
            </Link>
          ) : acceptedConversation || existingListingConversation ? (
            <Link
              href={`${APP_ROUTES.MESSAGES}/${(acceptedConversation ?? existingListingConversation)!.id}`}
              className="flex h-12 shrink-0 items-center rounded-xl bg-mint-mist px-5 text-sm font-extrabold text-pine"
            >
              {t('listingDetail.goToChat')}
            </Link>
          ) : (
            <Link href={similarHref} className="flex h-12 shrink-0 items-center rounded-xl border border-outline px-5 text-sm font-extrabold text-pine">
              {t('listingDetail.similarRooms')}
            </Link>
          )}
        </div>
      </div>

      <DialogPrimitive.Root open={showContact && !isOwnListing} onOpenChange={setContactOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              document.getElementById('first-message')?.focus();
            }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[20px] bg-paper p-6 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-float data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-6 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogPrimitive.Title className="mt-1 text-2xl font-black tracking-[-0.04em] text-pine">
                  {t('listingDetail.message')} {ownerFirstName}
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close
                aria-label={t('searchBar.close')}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sage transition-colors hover:bg-mint-mist hover:text-pine"
                data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_CLOSE_CONTACT}
              >
                <X size={20} />
              </DialogPrimitive.Close>
            </div>
            <form onSubmit={sendFirstMessage}>
              <p className="mt-3 text-sm leading-6 text-sage">{t('listingDetail.modalInfoRequest')}</p>
              <p className="mt-4 rounded-xl bg-mint-mist p-3 text-xs font-bold leading-5 text-pine">{t('listingDetail.modalTip')}</p>
              <label htmlFor="first-message" className="sr-only">
                {t('listingDetail.message')} {ownerFirstName}
              </label>
              <textarea
                id="first-message"
                value={firstMessage}
                onChange={(event) => setFirstMessage(event.target.value)}
                rows={4}
                maxLength={MESSAGE_MAX_LENGTH_CHARS}
                placeholder={t('listingDetail.firstMessagePlaceholder')}
                className="mt-4 w-full resize-none rounded-xl border border-field bg-cream p-3 text-base text-ink outline-none placeholder:text-sage focus:border-shutter focus:ring-[3px] focus:ring-mint-wash/40 sm:text-sm"
                data-testid={LISTING_DETAIL_TEST_IDS.INPUT_FIRST_MESSAGE}
              />
              {startConversation.isError && (
                <p className="mt-2 text-sm font-bold text-terracotta" role="alert" data-testid={LISTING_DETAIL_TEST_IDS.STATUS_CONTACT_ERROR}>
                  {getStartConversationErrorMessage()}
                </p>
              )}
              <button
                type="submit"
                className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-sun text-[15px] font-black text-ink transition-colors hover:bg-sun-hover disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!firstMessage.trim() || startConversation.isPending}
                data-testid={LISTING_DETAIL_TEST_IDS.BUTTON_CONTACT_SEND}
              >
                <Send size={16} aria-hidden /> {t('listingDetail.sendRequest')}
              </button>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </AppShell>
  );
}
