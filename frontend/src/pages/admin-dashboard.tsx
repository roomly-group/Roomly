import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowRight, BadgeCheck, FileSignature, Flag, Home, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import { API_BASE_PATH, API_ROUTE_PATHS, type AdminStats } from '@workspace/api-zod';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useFormat } from '@/hooks/use-format';
import { isVerificationPreview } from '@/pages/verification';
import { AppShell } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { QueryError } from '@/components/shared/query-error';
import { Button } from '@/components/shared/button';
import { Skeleton } from '@/components/ui/skeleton';

// Admin dashboard (/admin, admins only): the work queues the team handles by
// hand, then the key numbers of the app. Backend: GET /api/admin/stats
// (routes/admin.ts). Only counts and the few rows the queues need.

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** The dashboard refreshes itself this often while open (ms). */
const ADMIN_STATS_REFETCH_MS = 60_000 as const;
/** A registration deadline this close (days) is shown as urgent. */
const DEADLINE_WARNING_DAYS = 7 as const;

const adminStatsUrl = `${API_BASE_PATH}${API_ROUTE_PATHS.ADMIN_STATS}`;

const DAY_MS = 86_400_000;

// ===================== PREVIEW =====================

const PREVIEW_STATS: AdminStats = {
  generatedAt: new Date().toISOString(),
  users: { total: 412, students: 371, owners: 41, newThisWeek: 38, onboardingCompleted: 298, invited: 64 },
  discoverySources: [
    { source: 'instagram', count: 161 },
    { source: 'tiktok', count: 97 },
    { source: 'amico', count: 84 },
    { source: 'google', count: 40 },
    { source: 'linkedin', count: 18 },
    { source: 'ai', count: 9 },
    { source: 'facebook', count: 6 },
    { source: 'altro', count: 4 },
  ],
  listings: { active: 57, available: 39, rented: 18, newThisWeek: 6 },
  requests: { pending: 23, accepted: 31, rejected: 12, cancelled: 5 },
  contracts: { active: 14, toSign: 3, toRegister: 2, monthlyRentUnderContract: 6720 },
  verifications: {
    pending: 4,
    oldestPendingAt: new Date(Date.now() - 19 * 3_600_000).toISOString(),
    approved: 27,
    rejected: 5,
    rejectionReasons: [
      { reason: 'document_unreadable', count: 3 },
      { reason: 'challenge_not_done', count: 2 },
    ],
  },
  reports: { open: 2, oldestOpenAt: new Date(Date.now() - 26 * 3_600_000).toISOString() },
  queues: {
    contractsToRegister: [
      {
        id: 1,
        roomTitle: 'Stanza singola zona Navigli',
        ownerName: 'Giulia Esposito',
        studentName: 'Lukas Becker',
        signedOn: new Date(Date.now() - 26 * DAY_MS).toISOString().slice(0, 10),
        registrationDeadline: new Date(Date.now() + 4 * DAY_MS).toISOString().slice(0, 10),
      },
      {
        id: 2,
        roomTitle: 'Doppia vicino al Politecnico',
        ownerName: 'Marco Rinaldi',
        studentName: 'Ana Souza',
        signedOn: new Date(Date.now() - 6 * DAY_MS).toISOString().slice(0, 10),
        registrationDeadline: new Date(Date.now() + 24 * DAY_MS).toISOString().slice(0, 10),
      },
    ],
    recentListings: [
      { id: 11, title: 'Camera luminosa Città Studi', city: 'Milano', ownerName: 'Paola Neri', price: 520, createdAt: new Date(Date.now() - DAY_MS).toISOString() },
      { id: 12, title: 'Singola con bagno privato', city: 'Bologna', ownerName: 'Luca Ferri', price: 480, createdAt: new Date(Date.now() - 3 * DAY_MS).toISOString() },
    ],
  },
};

// ===================== DATA =====================

function useAdminStats(enabled: boolean) {
  return useQuery({
    queryKey: [adminStatsUrl],
    queryFn: () => customFetch<AdminStats>(adminStatsUrl, { method: 'GET', credentials: 'include' }),
    enabled,
    refetchInterval: ADMIN_STATS_REFETCH_MS,
  });
}

/** "19 h" or "3 d" since the given moment. */
function waitedFor(iso: string, now: number): string {
  const hours = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 3_600_000));
  return hours < 48 ? `${hours} h` : `${Math.floor(hours / 24)} d`;
}

const fill = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, value), text);

// ===================== PAGE =====================

export function AdminDashboardPage() {
  const { t, language } = useLanguage();
  const preview = isVerificationPreview();
  const query = useAdminStats(!preview);
  const stats = preview ? PREVIEW_STATS : query.data;
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(language, { timeStyle: 'short' }), [language]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8 lg:py-12">
        {preview ? (
          <p className="mb-6 rounded-xl bg-sun/30 px-4 py-2.5 text-sm font-bold text-ink" role="note">
            {t('verification.previewBanner')}
          </p>
        ) : null}
        <PageIntro
          eyebrow={t('adminDashboard.title')}
          title={t('adminDashboard.title')}
          description={t('adminDashboard.subtitle')}
          action={
            <div className="flex items-center gap-3">
              {stats ? (
                <span className="text-xs font-bold text-sage">
                  {fill(t('adminDashboard.updatedAt'), { time: timeFormat.format(new Date(stats.generatedAt)) })}
                </span>
              ) : null}
              <Button variant="outline" onClick={() => void query.refetch()} disabled={preview || query.isFetching} data-testid="button-refresh-admin">
                <RefreshCw size={16} className={cn(query.isFetching && 'animate-spin')} aria-hidden />
                {t('adminDashboard.refresh')}
              </Button>
            </div>
          }
        />

        {!preview && query.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : !preview && query.isError ? (
          <QueryError onRetry={() => void query.refetch()} />
        ) : stats ? (
          <Dashboard stats={stats} />
        ) : null}
      </div>
    </AppShell>
  );
}

function Dashboard({ stats }: { stats: AdminStats }) {
  const { t } = useLanguage();
  const format = useFormat();
  const now = Date.now();
  const decided = stats.requests.accepted + stats.requests.rejected;
  const acceptance = decided > 0 ? `${Math.round((stats.requests.accepted / decided) * 100)}%` : t('adminDashboard.none');

  return (
    <div className="space-y-10">
      {/* ---------- Work queues ---------- */}
      <section aria-labelledby="admin-queues">
        <h2 id="admin-queues" className="mb-4 text-xl font-black text-pine">{t('adminDashboard.queuesTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <QueueCard
            icon={<Flag size={20} aria-hidden />}
            label={t('adminDashboard.queueReports')}
            value={stats.reports.open}
            hint={
              stats.reports.oldestOpenAt
                ? fill(t('adminDashboard.queueReportsOldest'), { time: waitedFor(stats.reports.oldestOpenAt, now) })
                : t('adminDashboard.queueReportsNone')
            }
            href={APP_ROUTES.ADMIN_REPORTS}
            urgent={stats.reports.open > 0}
            testId="queue-reports"
          />
          <QueueCard
            icon={<ShieldCheck size={20} aria-hidden />}
            label={t('adminDashboard.queueVerifications')}
            value={stats.verifications.pending}
            hint={
              stats.verifications.oldestPendingAt
                ? fill(t('adminDashboard.queueVerificationsOldest'), { time: waitedFor(stats.verifications.oldestPendingAt, now) })
                : t('adminDashboard.queueVerificationsNone')
            }
            href={APP_ROUTES.ADMIN_VERIFICATIONS}
            urgent={stats.verifications.pending > 0}
            testId="queue-verifications"
          />
          <QueueCard
            icon={<FileSignature size={20} aria-hidden />}
            label={t('adminDashboard.queueContracts')}
            value={stats.contracts.toRegister}
            hint={t('adminDashboard.queueContractsHint')}
            href="#admin-contracts-queue"
            urgent={stats.contracts.toRegister > 0}
            testId="queue-contracts"
          />
          <QueueCard
            icon={<MessageCircle size={20} aria-hidden />}
            label={t('adminDashboard.queueRequests')}
            value={stats.requests.pending}
            hint={t('adminDashboard.queueRequestsHint')}
            testId="queue-requests"
          />
          <QueueCard
            icon={<Home size={20} aria-hidden />}
            label={t('adminDashboard.queueListings')}
            value={stats.listings.newThisWeek}
            hint={t('adminDashboard.queueListingsHint')}
            href="#admin-listings-queue"
            testId="queue-listings"
          />
        </div>
      </section>

      {/* ---------- Key numbers ---------- */}
      <section aria-labelledby="admin-numbers">
        <h2 id="admin-numbers" className="mb-4 text-xl font-black text-pine">{t('adminDashboard.numbersTitle')}</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <NumberGroup
            title={t('adminDashboard.users')}
            rows={[
              ['adminDashboard.usersTotal', stats.users.total],
              ['adminDashboard.usersStudents', stats.users.students],
              ['adminDashboard.usersOwners', stats.users.owners],
              ['adminDashboard.usersNew', stats.users.newThisWeek],
              ['adminDashboard.usersOnboarded', stats.users.onboardingCompleted],
              ['adminDashboard.usersInvited', stats.users.invited],
            ]}
          />
          <NumberGroup
            title={t('adminDashboard.listings')}
            rows={[
              ['adminDashboard.listingsActive', stats.listings.active],
              ['adminDashboard.listingsAvailable', stats.listings.available],
              ['adminDashboard.listingsRented', stats.listings.rented],
            ]}
          />
          <NumberGroup
            title={t('adminDashboard.requests')}
            rows={[
              ['adminDashboard.requestsPending', stats.requests.pending],
              ['adminDashboard.requestsAccepted', stats.requests.accepted],
              ['adminDashboard.requestsRejected', stats.requests.rejected],
              ['adminDashboard.requestsCancelled', stats.requests.cancelled],
              ['adminDashboard.requestsAcceptance', acceptance],
            ]}
          />
          <NumberGroup
            title={t('adminDashboard.contracts')}
            rows={[
              ['adminDashboard.contractsActive', stats.contracts.active],
              ['adminDashboard.contractsToSign', stats.contracts.toSign],
              ['adminDashboard.contractsRent', format.price(stats.contracts.monthlyRentUnderContract)],
            ]}
          />
          <NumberGroup
            title={t('adminDashboard.verifications')}
            rows={[
              ['adminDashboard.verificationsApproved', stats.verifications.approved],
              ['adminDashboard.verificationsRejected', stats.verifications.rejected],
            ]}
            footer={
              stats.verifications.rejectionReasons.length > 0 ? (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-sage">{t('adminDashboard.rejectionReasons')}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {stats.verifications.rejectionReasons.map((item) => (
                      <li key={item.reason} className="flex justify-between gap-3">
                        <span className="text-ink">{t(`verification.reason.${item.reason}` as TranslationKey)}</span>
                        <span className="font-black tabular-nums text-pine">{item.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            }
          />
          <SourcesCard stats={stats} />
        </div>
      </section>

      {/* ---------- Queue details ---------- */}
      <section id="admin-contracts-queue" aria-labelledby="admin-contracts-title" className="scroll-mt-24">
        <h2 id="admin-contracts-title" className="mb-4 text-xl font-black text-pine">{t('adminDashboard.contractsQueueTitle')}</h2>
        <ContractsTable stats={stats} />
      </section>

      <section id="admin-listings-queue" aria-labelledby="admin-listings-title" className="scroll-mt-24">
        <h2 id="admin-listings-title" className="mb-4 text-xl font-black text-pine">{t('adminDashboard.listingsQueueTitle')}</h2>
        <ListingsTable stats={stats} />
      </section>
    </div>
  );
}

// ===================== PIECES =====================

function QueueCard({
  icon,
  label,
  value,
  hint,
  href,
  urgent = false,
  testId,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  href?: string;
  urgent?: boolean;
  testId: string;
}) {
  const { t } = useLanguage();
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cn('grid h-10 w-10 place-items-center rounded-xl', urgent ? 'bg-sun/40 text-ink' : 'bg-mint-mist text-shutter')}>{icon}</span>
        {href ? (
          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-shutter">
            {t('adminDashboard.open')}
            <ArrowRight size={14} aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-4xl font-black tabular-nums tracking-[-0.03em] text-pine">{value}</p>
      <p className="mt-1 text-sm font-extrabold text-ink">{label}</p>
      <p className="mt-1 text-xs font-bold text-sage">{hint}</p>
    </>
  );
  const className = 'surface block rounded-2xl p-5 transition-shadow';
  if (!href) return <div className={className} data-testid={testId}>{body}</div>;
  return href.startsWith('#') ? (
    <a href={href} className={cn(className, 'hover:shadow-lift')} data-testid={testId}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cn(className, 'hover:shadow-lift')} data-testid={testId}>
      {body}
    </Link>
  );
}

function NumberGroup({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: [TranslationKey, number | string][];
  footer?: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="surface rounded-2xl p-5">
      <h3 className="text-sm font-extrabold uppercase tracking-[0.08em] text-sage">{title}</h3>
      <dl className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-ink">{t(label)}</dt>
            <dd className="text-lg font-black tabular-nums text-pine">{value}</dd>
          </div>
        ))}
      </dl>
      {footer}
    </div>
  );
}

function SourcesCard({ stats }: { stats: AdminStats }) {
  const { t } = useLanguage();
  const max = Math.max(1, ...stats.discoverySources.map((item) => item.count));
  return (
    <div className="surface rounded-2xl p-5">
      <h3 className="text-sm font-extrabold uppercase tracking-[0.08em] text-sage">{t('adminDashboard.sourcesTitle')}</h3>
      <ul className="mt-3 space-y-2">
        {stats.discoverySources.map((item) => (
          <li key={item.source}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-ink">{t(`onboarding.source.${item.source}` as TranslationKey)}</span>
              <span className="font-black tabular-nums text-pine">{item.count}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full rounded-full bg-shutter" style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-sage">{t('adminDashboard.sourcesHint')}</p>
    </div>
  );
}

function ContractsTable({ stats }: { stats: AdminStats }) {
  const { t } = useLanguage();
  const format = useFormat();
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + DEADLINE_WARNING_DAYS * DAY_MS).toISOString().slice(0, 10);
  const rows = stats.queues.contractsToRegister;
  if (rows.length === 0) return <EmptyBox />;
  return (
    <div className="surface overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line text-xs font-extrabold uppercase tracking-[0.08em] text-sage">
          <tr>
            <th className="px-5 py-3">{t('adminDashboard.colRoom')}</th>
            <th className="px-5 py-3">{t('adminDashboard.colOwner')}</th>
            <th className="px-5 py-3">{t('adminDashboard.colStudent')}</th>
            <th className="px-5 py-3">{t('adminDashboard.colSigned')}</th>
            <th className="px-5 py-3">{t('adminDashboard.colDeadline')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const overdue = row.registrationDeadline < today;
            const close = !overdue && row.registrationDeadline <= soon;
            return (
              <tr key={row.id}>
                <td className="px-5 py-3 font-bold text-pine">{row.roomTitle}</td>
                <td className="px-5 py-3 text-ink">{row.ownerName}</td>
                <td className="px-5 py-3 text-ink">{row.studentName}</td>
                <td className="px-5 py-3 text-ink">{format.date(row.signedOn)}</td>
                <td className="px-5 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-extrabold',
                      overdue ? 'bg-terracotta-mist text-terracotta' : close ? 'bg-sun/40 text-ink' : 'bg-mint-mist text-pine',
                    )}
                  >
                    {overdue ? `${t('adminDashboard.overdue')} · ` : ''}
                    {format.date(row.registrationDeadline)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ListingsTable({ stats }: { stats: AdminStats }) {
  const { t } = useLanguage();
  const format = useFormat();
  const rows = stats.queues.recentListings;
  if (rows.length === 0) return <EmptyBox />;
  return (
    <div className="surface overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line text-xs font-extrabold uppercase tracking-[0.08em] text-sage">
          <tr>
            <th className="px-5 py-3">{t('adminDashboard.colListing')}</th>
            <th className="px-5 py-3">{t('adminDashboard.colOwner')}</th>
            <th className="px-5 py-3">{t('adminDashboard.colPrice')}</th>
            <th className="px-5 py-3">{t('adminDashboard.colPublished')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-5 py-3">
                <Link href={APP_ROUTES.LISTING_DETAIL.replace(':id', String(row.id))} className="font-bold text-pine hover:underline">
                  {row.title}
                </Link>
                {row.city ? <span className="block text-xs text-sage">{row.city}</span> : null}
              </td>
              <td className="px-5 py-3 text-ink">{row.ownerName}</td>
              <td className="px-5 py-3 font-bold tabular-nums text-ink">{format.price(row.price)}</td>
              <td className="px-5 py-3 text-ink">{format.date(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyBox() {
  const { t } = useLanguage();
  return (
    <p className="surface flex items-center justify-center gap-2 rounded-2xl px-6 py-10 text-sm font-bold text-sage">
      <BadgeCheck size={16} className="text-shutter" aria-hidden />
      {t('adminDashboard.empty')}
    </p>
  );
}
