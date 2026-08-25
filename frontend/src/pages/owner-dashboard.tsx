import { useState } from 'react';
import { ArrowRight, Check, Clock3, House, MessageCircle, MoreHorizontal, PenLine, Plus, Sparkles, Star } from 'lucide-react';
import { Link } from 'wouter';
import { getGetOwnerDashboardQueryKey, useGetOwnerDashboard } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { formatPrice } from '@/lib/constants';
import { useZoneLabel } from '@/hooks/use-zone-label';
import { AppShell } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { QueryError } from '@/components/shared/query-error';

function OwnerListingRow({
  title,
  zone,
  price,
  status,
}: {
  title: string;
  zone: string;
  price: string;
  status: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#dbe8e0] p-3">
      <div className="hidden h-12 w-16 rounded-lg bg-gradient-to-br from-[#a6dfca] to-[#efc68e] sm:block" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-black text-[#085041]">{title}</h3>
        <p className="mt-0.5 text-xs font-bold text-[#527067]">
          {zone} · {price}
          {t('common.perMonth')}
        </p>
      </div>
      <span className="hidden rounded-full bg-[#E1F5EE] px-2.5 py-1 text-[11px] font-black text-[#0F6E56] sm:inline-flex">
        <Check size={12} className="mr-1" />
        {status}
      </span>
      <span
        className="rounded-lg p-2 text-[#9ab8ab]"
        title={t('dashboard.editingSoon')}
        data-testid={`status-owner-listing-${title.replace(/\s/g, '-').toLowerCase()}`}
      >
        <PenLine size={16} />
      </span>
    </div>
  );
}

export function OwnerDashboard() {
  const { t } = useLanguage();
  const zoneLabel = useZoneLabel();
  const { data, isLoading, isError, refetch } = useGetOwnerDashboard({
    query: { queryKey: getGetOwnerDashboardQueryKey() },
  });
  const dashboard = data;
  const [listingOptionsOpen, setListingOptionsOpen] = useState(false);

  const metrics: Array<{ label: string; value: string | number; icon: typeof House }> = dashboard
    ? [
        { label: t('dashboard.metricActive'), value: dashboard.activeListings, icon: House },
        { label: t('dashboard.metricPending'), value: dashboard.pendingRequests, icon: Clock3 },
        { label: t('dashboard.metricChats'), value: dashboard.activeChats, icon: MessageCircle },
        { label: t('dashboard.metricMonth'), value: formatPrice(dashboard.monthlyEarnings), icon: ArrowRight },
        { label: t('dashboard.metricRating'), value: dashboard.averageRating.toFixed(1), icon: Star },
      ]
    : [];

  return (
    <AppShell owner>
      <div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12">
        <PageIntro
          eyebrow={t('dashboard.eyebrow')}
          title={t('dashboard.greeting')}
          description={t('dashboard.subtitle')}
          action={
            <Link
              href="/owner/listings/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#EF9F27] px-4 py-2.5 text-sm font-black text-[#2C2C2A] transition hover:bg-[#e6a53d]"
              data-testid="link-create-listing"
            >
              <Plus size={17} /> {t('dashboard.addListing')}
            </Link>
          }
        />

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((item) => (
              <div className="skeleton h-32 rounded-2xl" key={item} />
            ))}
          </div>
        ) : isError || !dashboard ? (
          <QueryError onRetry={() => refetch()} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {metrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    className={`surface page-enter delay-${Math.min(index + 1, 3)} rounded-2xl p-5`}
                    data-testid={`stat-owner-${metric.label.toLowerCase().replace(/\s/g, '-')}`}
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
                    data-testid="button-listings-more"
                    aria-label={t('dashboard.moreOptions')}
                  >
                    <MoreHorizontal size={19} />
                  </button>
                </div>

                {listingOptionsOpen && (
                  <p className="mt-3 rounded-lg bg-[#E1F5EE] px-3 py-2 text-xs font-bold text-[#0F6E56]" data-testid="status-listing-options">
                    {t('dashboard.publishedNote')}
                  </p>
                )}

                <div className="mt-6 space-y-3">
                  <OwnerListingRow
                    title={t('dashboard.sampleListing1')}
                    zone={zoneLabel('Riverside')}
                    price="£720"
                    status={t('dashboard.published')}
                  />
                  <OwnerListingRow
                    title={t('dashboard.sampleListing2')}
                    zone={zoneLabel('Maple Quarter')}
                    price="£680"
                    status={t('dashboard.published')}
                  />
                </div>
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
                  href="/owner/messages"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-black text-[#E1F5EE] hover:text-[#EF9F27]"
                  data-testid="link-owner-messages"
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
