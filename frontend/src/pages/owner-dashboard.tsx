import { useState, useEffect } from 'react';
import { ArrowRight, Check, Clock3, House, MessageCircle, MoreHorizontal, PenLine, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import {
  getGetOwnerDashboardQueryKey,
  getGetListingQueryKey,
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  useGetOwnerDashboard,
  useListConversations,
} from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES, formatPrice, MAX_PAGE_ENTRY_DELAY_INDEX } from '@/lib/constants';
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
import { QueryError } from '@/components/shared/query-error';
import { supabase } from '@/lib/supabase';
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
        queryClient.invalidateQueries({ queryKey: getGetOwnerDashboardQueryKey() }),
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
        queryClient.invalidateQueries({ queryKey: getGetOwnerDashboardQueryKey() }),
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
  const { data, isLoading, isError, refetch } = useGetOwnerDashboard({
    query: { queryKey: getGetOwnerDashboardQueryKey() },
  });
  const { data: listings, isLoading: listingsLoading, isError: listingsError } = useListOwnerListings();
  const { data: conversations } = useListConversations();
  const dashboard = data;
  const [listingOptionsOpen, setListingOptionsOpen] = useState(false);
  const [userName, setUserName] = useState<string>('Maya');
  const safeListings = listings ?? [];

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const user = session.user;
        let name = '';
        if (user.user_metadata?.full_name) {
          name = user.user_metadata.full_name;
        } else if (user.user_metadata?.name) {
          name = user.user_metadata.name;
        } else if (user.user_metadata?.email) {
          const emailMatch = user.user_metadata.email?.match(/^([^@]+)/);
          name = emailMatch ? emailMatch[1] : '';
        } else if (user.email) {
          const emailMatch = user.email?.match(/^([^@]+)/);
          name = emailMatch ? emailMatch[1] : '';
        }
        if (name) {
          setUserName(name);
        }
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const user = session.user;
        let name = '';
        if (user.user_metadata?.full_name) {
          name = user.user_metadata.full_name;
        } else if (user.user_metadata?.name) {
          name = user.user_metadata.name;
        } else if (user.user_metadata?.email) {
          const emailMatch = user.user_metadata.email?.match(/^([^@]+)/);
          name = emailMatch ? emailMatch[1] : '';
        } else if (user.email) {
          const emailMatch = user.email?.match(/^([^@]+)/);
          name = emailMatch ? emailMatch[1] : '';
        }
        setUserName(name || 'Maya');
      } else {
        setUserName('Maya');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const metrics: Array<{ label: string; value: string | number; icon: typeof House }> = dashboard
    ? [
        { label: t('dashboard.metricActive'), value: dashboard.activeListings ?? 0, icon: House },
        { label: t('dashboard.metricPending'), value: dashboard.pendingRequests ?? 0, icon: Clock3 },
        { label: t('dashboard.metricMonth'), value: formatPrice(dashboard.monthlyEarnings ?? 0), icon: ArrowRight },
        { label: t('dashboard.metricRating'), value: (dashboard.averageRating ?? 0).toFixed(1), icon: Star },
      ]
    : [];

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12">
        <PageIntro
          eyebrow={t('dashboard.eyebrow')}
          title={t('dashboard.greeting').replace('{name}', userName)}
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

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div className="skeleton h-32 rounded-2xl" key={item} />
            ))}
          </div>
        ) : isError || !dashboard ? (
          <QueryError onRetry={() => refetch()} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    className={`surface page-enter delay-${Math.min(index + 1, MAX_PAGE_ENTRY_DELAY_INDEX)} rounded-2xl p-5`}
                    data-testid={`${OWNER_DASHBOARD_TEST_IDS.STAT_OWNER_PREFIX}${metric.label.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <div className="mb-5 flex items-start justify-between">
                      <p className="max-w-[100px] text-xs font-extrabold leading-4 text-[#527067]">{metric.label}</p>
                      <span className="rounded-lg bg-[#E1F5EE] p-2 text-[#0F6E56]">
                        <Icon size={17} fill={metric.label === t('dashboard.metricRating') ? 'currentColor' : 'none'} />
                      </span>
                    </div>
                    <p className="text-3xl font-black text-[#085041]">{metric.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-7 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
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
                            price={`£${listing.price ?? 0}`}
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

              <section className="rounded-2xl bg-[#085041] p-5 text-[#E1F5EE] sm:p-7">
                <div className="mb-7 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.14em] text-[#9FE1CB]">
                      {t('dashboard.yourRhythm')}
                    </p>
                    <h2 className="mt-2 text-xl font-black">{t('dashboard.goodMonth')}</h2>
                  </div>
                  <Sparkles className="text-[#EF9F27]" size={22} />
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex justify-between text-xs font-bold text-[#9FE1CB]">
                      <span>{t('dashboard.listingViews')}</span>
                      <span>72%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#286b5b]">
                      <div className="h-2 w-[72%] rounded-full bg-[#9FE1CB]" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-xs font-bold text-[#9FE1CB]">
                      <span>{t('dashboard.replyRate')}</span>
                      <span>91%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#286b5b]">
                      <div className="h-2 w-[91%] rounded-full bg-[#EF9F27]" />
                    </div>
                  </div>
                </div>

                <Link
                  href={APP_ROUTES.OWNER_MESSAGES}
                  className="mt-8 inline-flex items-center gap-2 text-sm font-black text-[#E1F5EE] hover:text-[#EF9F27]"
                  data-testid={OWNER_DASHBOARD_TEST_IDS.LINK_OWNER_MESSAGES}
                >
                  {t('dashboard.openInbox')} <ArrowRight size={16} />
                </Link>
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}