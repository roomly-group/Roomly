import { useState } from 'react';
import { ArrowRight, Check, Eye, Inbox, MessageCircle, MoreHorizontal, PenLine, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'wouter';
import type { Conversation } from '@workspace/api-client-react';
import {
  getGetListingQueryKey,
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  useListConversations,
} from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES } from '@/lib/constants';
import { useFormat } from '@/hooks/use-format';
import { useZoneLabel } from '@/hooks/use-zone-label';
import { Button } from '@/components/shared/button';
import { useReleaseListing } from '@/hooks/use-release-listing';
import { useAcceptConversation } from '@/hooks/use-accept-conversation';
import { useRejectConversation } from '@/hooks/use-reject-conversation';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useListOwnerListings } from '@/hooks/use-list-owner-listings';
import { useQueryClient } from '@tanstack/react-query';
import { getOwnerListingsQueryKey } from '@/hooks/use-list-owner-listings';
import { useDeleteOwnerListing } from '@/hooks/use-delete-owner-listing';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { QueryError } from '@/components/shared/query-error';
import { ListingPhotoPlaceholder } from '@/components/shared/listing-card';
import { useAccount } from '@/lib/account-cache';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ===================== CONFIGURATION =====================

/** Stable test selectors used by owner dashboard controls. */
const OWNER_DASHBOARD_TEST_IDS = {
  BUTTON_RELEASE_LISTING_PREFIX: 'button-release-listing-',
  LINK_EDIT_LISTING_PREFIX: 'link-edit-listing-',
  BUTTON_DELETE_LISTING_PREFIX: 'button-delete-listing-',
  BUTTON_LISTING_MENU_PREFIX: 'button-listing-menu-',
  LINK_CREATE_LISTING: 'link-create-listing',
  LINK_OWNER_MESSAGES: 'link-owner-messages',
  ROW_REQUEST_PREFIX: 'row-request-',
  BUTTON_ACCEPT_PREFIX: 'button-accept-request-',
  BUTTON_REJECT_PREFIX: 'button-reject-request-',
} as const;

const SECTION_TITLE_CLASS = 'text-[22px] font-black leading-[1.1] tracking-[-0.04em] text-pine';
const DESTRUCTIVE_ACTION_CLASS = 'bg-terracotta text-paper hover:bg-terracotta/90';

/** One pending request: who, for which room, when, and the owner's three answers. */
function RequestRow({ conversation }: { conversation: Conversation }) {
  const { t } = useLanguage();
  const format = useFormat();
  const client = useQueryClient();
  const { toast } = useToast();
  const acceptConversation = useAcceptConversation();
  const rejectConversation = useRejectConversation();
  const [confirm, setConfirm] = useState<'accept' | 'reject' | null>(null);
  const pending = acceptConversation.isPending || rejectConversation.isPending;
  const chatHref = `${APP_ROUTES.OWNER_MESSAGES}/${conversation.id}`;

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await Promise.all([
        client.invalidateQueries({ queryKey: getListConversationsQueryKey() }),
        client.invalidateQueries({ queryKey: getListMessagesQueryKey(conversation.id) }),
        client.invalidateQueries({ queryKey: getGetListingQueryKey(conversation.roomId) }),
        client.invalidateQueries({ queryKey: getOwnerListingsQueryKey() }),
      ]);
    } catch {
      toast({ title: t('messages.actionFailed'), description: t('messages.sendError'), variant: 'destructive' });
    } finally {
      setConfirm(null);
    }
  };

  return (
    <li
      className="rounded-2xl border border-pine/10 bg-paper p-4 shadow-rest sm:p-5"
      data-testid={`${OWNER_DASHBOARD_TEST_IDS.ROW_REQUEST_PREFIX}${conversation.id}`}
    >
      <div className="flex items-start gap-3">
        <Avatar name={conversation.participant} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-[15px] font-black text-pine">{conversation.participant}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-mist px-2.5 py-1 text-xs font-black text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-sun" aria-hidden />
              {t('messages.status.in_attesa')}
            </span>
            <span className="ml-auto text-xs font-bold tabular-nums text-sage">{format.date(conversation.updatedAt)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-extrabold text-shutter">{conversation.listingTitle}</p>
          {conversation.preview && <p className="mt-1 line-clamp-2 text-sm leading-5 text-sage">{conversation.preview}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 sm:pl-[52px]">
        <button
          type="button"
          onClick={() => setConfirm('accept')}
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-shutter px-4 text-sm font-extrabold text-mint-mist transition-colors hover:bg-pine disabled:opacity-50"
          data-testid={`${OWNER_DASHBOARD_TEST_IDS.BUTTON_ACCEPT_PREFIX}${conversation.id}`}
        >
          <Check size={16} aria-hidden /> {t('messages.accept')}
        </button>
        <button
          type="button"
          onClick={() => setConfirm('reject')}
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-outline px-4 text-sm font-extrabold text-pine transition-colors hover:border-shutter hover:bg-mint-mist disabled:opacity-50"
          data-testid={`${OWNER_DASHBOARD_TEST_IDS.BUTTON_REJECT_PREFIX}${conversation.id}`}
        >
          <X size={16} aria-hidden /> {t('messages.reject')}
        </button>
        <Link
          href={chatHref}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-extrabold text-ink transition-colors hover:bg-mint-mist"
        >
          <MessageCircle size={16} aria-hidden /> {t('dashboard.openChat')}
        </Link>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'accept' ? t('messages.acceptConversation') : t('messages.rejectConversation')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'accept' ? t('messages.acceptConversationDescription') : t('messages.rejectConversationDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className={confirm === 'reject' ? DESTRUCTIVE_ACTION_CLASS : undefined}
              onClick={() =>
                void run(() =>
                  confirm === 'accept'
                    ? acceptConversation.mutateAsync({ id: conversation.id })
                    : rejectConversation.mutateAsync({ id: conversation.id }),
                )
              }
            >
              {confirm === 'accept' ? t('messages.accept') : t('messages.reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

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
  price: number;
  available: boolean;
  rented: boolean;
  conversationId?: number;
  coverPhotoUrl?: string;
}) {
  const { t } = useLanguage();
  const format = useFormat();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const releaseListing = useReleaseListing();
  const deleteListing = useDeleteOwnerListing();

  const statusText = rented ? t('dashboard.rented') : available ? t('common.availableNow') : t('common.notAvailable');
  const publicHref = `${APP_ROUTES.LISTINGS}/${id}`;
  const editHref = `${APP_ROUTES.OWNER_LISTINGS}/${id}/edit`;

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
        description: t('dashboard.releaseFailed'),
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
    <li className="flex items-center gap-3 py-4">
      <Link href={publicHref} className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl">
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-line">
          {coverPhotoUrl ? (
            <img src={coverPhotoUrl} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <ListingPhotoPlaceholder id={id} showLabel={false} className="absolute inset-0" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-black text-pine decoration-shutter underline-offset-4 group-hover:underline">
            {title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-sage">
            <span className="whitespace-nowrap tabular-nums text-shutter">
              {format.price(price)}
              <span className="text-sage">{t('common.perMonth')}</span>
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 font-black',
                rented ? 'bg-pine text-mint-mist' : available ? 'bg-mint-mist text-pine' : 'bg-cream text-sage',
              )}
            >
              {rented ? <Check size={12} aria-hidden /> : <span className={cn('h-1.5 w-1.5 rounded-full', available ? 'bg-shutter' : 'bg-sage')} aria-hidden />}
              {statusText}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-sage">{zone}</span>
        </span>
      </Link>

      {rented && (
        <Button
          variant="outline"
          onClick={() => setIsReleaseDialogOpen(true)}
          disabled={releaseListing.isPending}
          className="min-h-11 shrink-0 px-3 text-xs"
          data-testid={`${OWNER_DASHBOARD_TEST_IDS.BUTTON_RELEASE_LISTING_PREFIX}${id}`}
        >
          {t('messages.releaseRoom')}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('dashboard.listingActions')}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-pine transition-colors hover:bg-mint-mist data-[state=open]:bg-mint-mist"
          data-testid={`${OWNER_DASHBOARD_TEST_IDS.BUTTON_LISTING_MENU_PREFIX}${id}`}
        >
          <MoreHorizontal size={19} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-xl border-pine/10 bg-paper p-1.5 shadow-lift">
          <DropdownMenuItem asChild className="min-h-10 cursor-pointer gap-2 rounded-lg font-bold text-ink">
            <Link href={editHref} data-testid={`${OWNER_DASHBOARD_TEST_IDS.LINK_EDIT_LISTING_PREFIX}${id}`}>
              <PenLine size={16} className="text-shutter" aria-hidden /> {t('dashboard.editListing')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-10 cursor-pointer gap-2 rounded-lg font-bold text-ink">
            <Link href={publicHref}>
              <Eye size={16} className="text-shutter" aria-hidden /> {t('dashboard.viewListing')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-line" />
          <DropdownMenuItem
            onSelect={() => setIsDeleteDialogOpen(true)}
            disabled={deleteListing.isPending}
            className="min-h-10 cursor-pointer gap-2 rounded-lg font-bold text-terracotta focus:bg-terracotta-mist focus:text-terracotta"
            data-testid={`${OWNER_DASHBOARD_TEST_IDS.BUTTON_DELETE_LISTING_PREFIX}${id}`}
          >
            <Trash2 size={16} aria-hidden /> {t('dashboard.deleteListing')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.deleteListingTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('dashboard.deleteListingDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              disabled={deleteListing.isPending}
              className={DESTRUCTIVE_ACTION_CLASS}
            >
              {t('dashboard.deleteListing')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

export function OwnerDashboard() {
  const { t } = useLanguage();
  const zoneLabel = useZoneLabel();
  const { account } = useAccount();
  const {
    data: listings,
    isLoading: listingsLoading,
    isError: listingsError,
    refetch: refetchListings,
  } = useListOwnerListings();
  const {
    data: conversations,
    isLoading: conversationsLoading,
    isError: conversationsError,
    refetch: refetchConversations,
  } = useListConversations();
  const safeListings = (listings ?? []).filter((listing): listing is NonNullable<typeof listing> => Boolean(listing));

  // Same name source as the header's profile menu (/api/me), so the two never disagree.
  const ownerName = account?.nome?.trim() || account?.full_name?.trim().split(' ')[0] || account?.email?.split('@')[0] || '';
  const greeting = ownerName
    ? t('dashboard.hello').replace('{name}', ownerName)
    : t('dashboard.hello').replace(/,?\s*\{name\}/, '');

  // Only counts computed from real data: earnings, rating and traffic stay off until they are tracked.
  const pendingRequests = (conversations ?? [])
    .filter((conversation) => conversation.role === 'owner' && conversation.requestStatus === 'in_attesa')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const activeListings = safeListings.filter((listing) => listing.available).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8 lg:px-8 lg:pt-10">
        <PageIntro
          eyebrow={t('dashboard.eyebrow')}
          title={greeting}
          description={t('dashboard.subtitle')}
          action={
            <Link
              href={APP_ROUTES.OWNER_LISTING_NEW}
              className="inline-flex min-h-12 items-center gap-2 self-start rounded-xl bg-sun px-5 text-sm font-black text-ink transition-colors hover:bg-sun-hover sm:self-auto"
              data-testid={OWNER_DASHBOARD_TEST_IDS.LINK_CREATE_LISTING}
            >
              <Plus size={17} aria-hidden /> {t('dashboard.addListing')}
            </Link>
          }
        />

        <div className="flex flex-wrap items-start gap-x-12 gap-y-10">
          <section data-reveal className="min-w-0 flex-[999_1_520px]" aria-labelledby="dashboard-requests">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 id="dashboard-requests" className={cn(SECTION_TITLE_CLASS, 'flex items-center gap-2.5')}>
                {t('dashboard.queueTitle')}
                {!conversationsLoading && pendingRequests.length > 0 && (
                  <span className="grid h-7 min-w-7 place-items-center rounded-full bg-pine px-2 text-sm font-black tabular-nums tracking-normal text-mint-mist">
                    {pendingRequests.length}
                  </span>
                )}
              </h2>
              <Link
                href={APP_ROUTES.OWNER_MESSAGES}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-black text-shutter transition-colors hover:text-pine"
                data-testid={OWNER_DASHBOARD_TEST_IDS.LINK_OWNER_MESSAGES}
              >
                {t('dashboard.allMessages')} <ArrowRight size={16} aria-hidden />
              </Link>
            </div>

            {conversationsLoading ? (
              <div className="space-y-3" aria-hidden>
                {[1, 2].map((item) => (
                  <div className="skeleton h-36 rounded-2xl" key={item} />
                ))}
              </div>
            ) : conversationsError ? (
              <QueryError onRetry={() => refetchConversations()} />
            ) : pendingRequests.length ? (
              <ul className="space-y-3">
                {pendingRequests.map((conversation) => (
                  <RequestRow key={conversation.id} conversation={conversation} />
                ))}
              </ul>
            ) : (
              <div className="flex items-start gap-4 rounded-2xl border border-dashed border-outline px-6 py-8">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[20px] bg-mint-mist text-shutter" aria-hidden>
                  <Inbox size={22} />
                </span>
                <div>
                  <p className="font-black text-pine">{t('dashboard.queueEmptyTitle')}</p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-sage">{t('dashboard.queueEmptyText')}</p>
                </div>
              </div>
            )}
          </section>

          <section data-reveal style={{ '--reveal-delay': '120ms' } as React.CSSProperties} className="w-full laptop:w-[380px]" aria-labelledby="dashboard-listings">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 id="dashboard-listings" className={SECTION_TITLE_CLASS}>
                {t('dashboard.yourListings')}
              </h2>
              {!listingsLoading && safeListings.length > 0 && (
                <span className="text-sm font-bold tabular-nums text-sage">
                  {t('dashboard.activeCount').replace('{n}', String(activeListings))}
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-pine/10 bg-paper px-4 shadow-rest sm:px-5">
              {listingsLoading ? (
                <div className="space-y-3 py-4" aria-hidden>
                  {[1, 2].map((item) => (
                    <div className="skeleton h-14 rounded-xl" key={item} />
                  ))}
                </div>
              ) : listingsError ? (
                <div className="py-4">
                  <QueryError onRetry={() => refetchListings()} />
                </div>
              ) : safeListings.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="font-black text-pine">{t('dashboard.emptyTitle')}</p>
                  <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-sage">{t('dashboard.emptyText')}</p>
                  <Link
                    href={APP_ROUTES.OWNER_LISTING_NEW}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-shutter px-4 text-sm font-black text-mint-mist transition-colors hover:bg-pine"
                  >
                    <Plus size={17} aria-hidden /> {t('dashboard.addListing')}
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {safeListings.map((listing) => {
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
                        price={listing.price ?? 0}
                        available={listing.available}
                        rented={Boolean(rentedConversation)}
                        conversationId={rentedConversation?.id}
                        coverPhotoUrl={listing.coverPhotoUrl}
                      />
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
