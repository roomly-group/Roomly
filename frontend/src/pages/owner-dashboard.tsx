import { useState } from 'react';
import { ArrowRight, Check, Clock3, House, MoreHorizontal, PenLine, Plus, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import {
  getGetListingQueryKey,
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  useListConversations,
} from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES } from '@/lib/constants';
import { useZoneLabel } from '@/hooks/use-zone-label';
import { Button } from '@/components/shared/button';
import { useReleaseListing } from '@/hooks/use-release-listing';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useListOwnerListings } from '@/hooks/use-list-owner-listings';
import { useQueryClient } from '@tanstack/react-query';
import { getOwnerListingsQueryKey } from '@/hooks/use-list-owner-listings';
import { useDeleteOwnerListing } from '@/hooks/use-delete-owner-listing';
import { AppShell } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { useAccount } from '@/lib/account-cache';
import { useToast } from '@/hooks/use-toast';

// ===================== CONFIGURATION =====================

/** Stable test selectors used by owner-listing dashboard controls. */
const OWNER_DASHBOARD_TEST_IDS = {
  BUTTON_RELEASE_LISTING_PREFIX: 'button-release-listing-',
  LINK_EDIT_LISTING_PREFIX: 'link-edit-listing-',
  BUTTON_DELETE_LISTING_PREFIX: 'button-delete-listing-',
  LINK_CREATE_LISTING: 'link-create-listing',
  STAT_OWNER_PREFIX: 'stat-owner-',
  BUTTON_LISTINGS_MORE: 'button-listings-more',
  STATUS_LISTING_OPTIONS: 'status-listing-options',
  LINK_OWNER_MESSAGES: 'link-owner-messages',
} as const;

function OwnerListingRow({
  id,
  title,
  zone,
  price,
  available,
  rented,
  conversationId,
  coverPhotoUrl,
}: {
  id: number;
  title: string;
  zone: string;
  price: string;
  available: boolean;
  rented: boolean;
  conversationId?: number;
  coverPhotoUrl?: string;
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const releaseListing = useReleaseListing();
  const deleteListing = useDeleteOwnerListing();

  const safeTitle = title ?? '';
  const safeZone = zone ?? '';
  const safePrice = price ?? '';
  const statusText = rented ? t('dashboard.rented') : available ? t('common.availableNow') : t('dashboard.published');

  const handleConfirmRelease = async () => {
    try {
      await releaseListing.mutateAsync({ id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() }),
        ...(conversationId ? [queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) })] : []),
        queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: getOwnerListingsQueryKey() }),
      ]);
      setIsReleaseDialogOpen(false);
    } catch {
      toast({
        title: t('messages.actionFailed'),
        description: t('messages.sendError'),
        variant: 'destructive',
      });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteListing.mutateAsync({ id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getOwnerListingsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() }),
      ]);
      setIsDeleteDialogOpen(false);
    } catch {
      toast({
        title: t('messages.actionFailed'),
        description: t('dashboard.deleteListingFailed'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#dbe8e0] p-3">
      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-[#a6dfca] to-[#efc68e]">
        {coverPhotoUrl && <img src={coverPhotoUrl} alt={safeTitle} crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-black text-[#085041]">{safeTitle}</h3>
        <p className="mt-0.5 text-xs font-bold text-[#527067]">
          {safeZone} · {safePrice}
          {t('common.perMonth')}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-[#E1F5EE] px-2.5 py-1 text-[11px] font-black text-[#0F6E56]">
            <Check size={12} className="mr-1" />
            {statusText}
          </span>
          <Link
            href={`${APP_ROUTES.OWNER_LISTINGS}/${id}/edit`}
            aria-label={t('dashboard.editListing')}
            title={t('dashboard.editListing')}
            data-testid={`${OWNER_DASHBOARD_TEST_IDS.LINK_EDIT_LISTING_PREFIX}${id}`}
            className="rounded-lg p-2 text-[#9ab8ab] hover:bg-[#E1F5EE] hover:text-[#0F6E56]"
          >
            <PenLine size={16} />
          </Link>
          {rented && (
            <Button
              variant="outline"
              onClick={() => setIsReleaseDialogOpen(true)}
              disabled={releaseListing.isPending}
              className="px-2.5 py-1.5 text-xs"
              data-testid={`${OWNER_DASHBOARD_TEST_IDS.BUTTON_RELEASE_LISTING_PREFIX}${id}`}
            >
              {t('messages.releaseRoom')}
            </Button>
          )}
        </div>
      </div>
      {rented && (
        <AlertDialog open={isReleaseDialogOpen} onOpenChange={setIsReleaseDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('messages.releaseListing')}</AlertDialogTitle>
              <AlertDialogDescription>{t('messages.releaseListingDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleConfirmRelease()} disabled={releaseListing.isPending}>
                {t('messages.releaseRoom')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <button
        type="button"
        onClick={() => setIsDeleteDialogOpen(true)}
        aria-label={t('dashboard.deleteListing')}
        title={t('dashboard.deleteListing')}
        disabled={deleteListing.isPending}
        data-testid={`${OWNER_DASHBOARD_TEST_IDS.BUTTON_DELETE_LISTING_PREFIX}${id}`}
        className="shrink-0 rounded-lg p-2 text-[#b45a4b] transition hover:bg-[#fbe9e6] disabled:opacity-50"
      >
        <Trash2 size={16} />
      </button>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.deleteListingTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('dashboard.deleteListingDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()} disabled={deleteListing.isPending}>
              {t('dashboard.deleteListing')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function OwnerDashboard() {
  const { t } = useLanguage();
  const zoneLabel = useZoneLabel();
  const { account } = useAccount();
  const { data: listings, isLoading: listingsLoading, isError: listingsError } = useListOwnerListings();
  const { data: conversations, isLoading: conversationsLoading } = useListConversations();
  const [listingOptionsOpen, setListingOptionsOpen] = useState(false);
  const safeListings = listings ?? [];

  // Same name source as the header's profile menu (/api/me), so the two never disagree.
  const ownerName = account?.full_name?.trim() || account?.email?.split('@')[0] || '';
  const greeting = ownerName
    ? t('dashboard.greeting').replace('{name}', ownerName)
    : t('dashboard.greeting').replace(/,?\s*\{name\}/, '');

  // Only counts computed from real data: earnings, rating and traffic stay off until they are tracked.
  const activeListings = safeListings.filter((listing) => listing?.available).length;
  const pendingRequests = (conversations ?? []).filter(
    (conversation) => conversation.role === 'owner' && conversation.requestStatus === 'in_attesa',
  ).length;
  const summary: Array<{ key: string; label: string; value: number | null; icon: typeof House }> = [
    { key: 'active', label: t('dashboard.metricActive'), value: listingsLoading ? null : activeListings, icon: House },
    { key: 'pending', label: t('dashboard.metricPending'), value: conversationsLoading ? null : pendingRequests, icon: Clock3 },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12">
        <PageIntro
          eyebrow={t('dashboard.eyebrow')}
          title={greeting}
          description={t('dashboard.subtitle')}
          action={
            <Link
              href={APP_ROUTES.OWNER_LISTING_NEW}
              className="inline-flex items-center gap-2 rounded-xl bg-[#EF9F27] px-4 py-2.5 text-sm font-black text-[#2C2C2A] transition hover:bg-[#e6a53d]"
              data-testid={OWNER_DASHBOARD_TEST_IDS.LINK_CREATE_LISTING}
            >
              <Plus size={17} /> {t('dashboard.addListing')}
            </Link>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="surface rounded-2xl p-5 sm:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">{t('dashboard.yourListings')}</p>
                <h2 className="mt-1 text-xl font-black text-[#085041]">{t('dashboard.makeCount')}</h2>
              </div>
              <button
                onClick={() => setListingOptionsOpen(!listingOptionsOpen)}
                className="rounded-lg p-2 text-[#527067] hover:bg-[#E1F5EE]"
                data-testid={OWNER_DASHBOARD_TEST_IDS.BUTTON_LISTINGS_MORE}
                aria-label={t('dashboard.moreOptions')}
              >
                <MoreHorizontal size={19} />
              </button>
            </div>

            {listingOptionsOpen && (
              <p className="mt-3 rounded-lg bg-[#E1F5EE] px-3 py-2 text-xs font-bold text-[#0F6E56]" data-testid={OWNER_DASHBOARD_TEST_IDS.STATUS_LISTING_OPTIONS}>
                {t('dashboard.publishedNote')}
              </p>
            )}

            {listingsLoading ? (
              <div className="mt-6 space-y-3">
                {[1, 2].map((item) => (
                  <div className="skeleton h-12 rounded-xl" key={item} />
                ))}
              </div>
            ) : listingsError ? (
              <div className="mt-6 space-y-3">
                <p className="text-center text-[#527067]">Failed to load listings</p>
              </div>
            ) : safeListings.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[#dbe8e0] bg-[#F7FAF8] p-6 text-center">
                <p className="text-base font-black text-[#085041]">No rooms published yet</p>
                <p className="mt-2 text-sm text-[#527067]">Create your first listing to start receiving enquiries.</p>
                <Link
                  href={APP_ROUTES.OWNER_LISTING_NEW}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#EF9F27] px-4 py-2.5 text-sm font-black text-[#2C2C2A]"
                >
                  <Plus size={17} /> {t('dashboard.addListing')}
                </Link>
              </div>
            ) : (
              <>
                {safeListings
                  .filter((listing): listing is NonNullable<typeof listing> => listing !== null && listing !== undefined)
                  .map((listing) => {
                    const rentedConversation = conversations?.find(
                      (conversation) =>
                        conversation.role === 'owner' &&
                        conversation.roomId === listing.id &&
                        conversation.roomStatus === 'affittata',
                    );
                    return (
                      <OwnerListingRow
                        key={listing.id}
                        id={listing.id}
                        title={listing.title ?? ''}
                        zone={zoneLabel(listing.zone ?? '')}
                        price={`€${listing.price ?? 0}`}
                        available={listing.available}
                        rented={Boolean(rentedConversation)}
                        conversationId={rentedConversation?.id}
                        coverPhotoUrl={listing.coverPhotoUrl}
                      />
                    );
                  })}
              </>
            )}
          </section>

          <aside className="surface h-fit rounded-2xl p-5 sm:p-7">
            <dl className="divide-y divide-[#e1ebe4]">
              {summary.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0"
                    data-testid={`${OWNER_DASHBOARD_TEST_IDS.STAT_OWNER_PREFIX}${item.key}`}
                  >
                    <dt className="flex items-center gap-3 text-sm font-extrabold text-[#527067]">
                      <span className="rounded-lg bg-[#E1F5EE] p-2 text-[#0F6E56]">
                        <Icon size={17} />
                      </span>
                      {item.label}
                    </dt>
                    <dd className="text-2xl font-black text-[#085041]">
                      {item.value === null ? <span className="skeleton inline-block h-7 w-8 rounded-md align-middle" /> : item.value}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <Link
              href={APP_ROUTES.OWNER_MESSAGES}
              className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#0F6E56] hover:text-[#085041]"
              data-testid={OWNER_DASHBOARD_TEST_IDS.LINK_OWNER_MESSAGES}
            >
              {t('dashboard.openInbox')} <ArrowRight size={16} />
            </Link>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
