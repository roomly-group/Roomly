import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Ban, CircleCheck, Eye, EyeOff, Flag, Loader2, MessageSquareText, UserRound, UserRoundCheck } from 'lucide-react';
import {
  REPORT_ADMIN_NOTE_MAX_LENGTH,
  type AdminReport,
  type AdminReportMessages,
  type AdminReportsList,
  type ReportStatus,
} from '@workspace/api-zod';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAdminReportActions, useAdminReportMessages, useAdminReports } from '@/hooks/use-safety';
import { isVerificationPreview } from '@/pages/verification';
import { AppShell } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { QueryError } from '@/components/shared/query-error';
import { Button } from '@/components/shared/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Reports page (/admin/segnalazioni, admins only; audit finding RMY-12).
// Open reports on the left, the selected one on the right: who reported whom
// and why, the reported message, and the admin actions. Only admins can act:
// suspend or reactivate the reported account, hide or show the listing, read
// the reported chat, close the report. Same layout as /admin/verifiche.
// Backend: routes/safety.ts.

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Filter tabs in display order. */
const TABS: { status: ReportStatus; label: TranslationKey }[] = [
  { status: 'aperta', label: 'adminReports.tabOpen' },
  { status: 'risolta', label: 'adminReports.tabResolved' },
  { status: 'archiviata', label: 'adminReports.tabDismissed' },
];

/** `utenti.stato` of a suspended account. */
const ACCOUNT_SUSPENDED = 'sospeso' as const;

/** Stable selectors for the reports page. */
const ADMIN_REPORT_TEST_IDS = {
  TAB_PREFIX: 'tab-reports-',
  ROW_PREFIX: 'row-report-',
  BUTTON_SUSPEND: 'button-toggle-suspend',
  BUTTON_LISTING: 'button-toggle-listing',
  BUTTON_CONVERSATION: 'button-show-conversation',
  INPUT_NOTE: 'input-report-note',
  BUTTON_RESOLVE: 'button-resolve-report',
  BUTTON_DISMISS: 'button-dismiss-report',
  BUTTON_CONFIRM: 'button-confirm-admin-action',
} as const;

const TEXTAREA_CLASS =
  'w-full rounded-xl border border-field bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-shutter focus:ring-2 focus:ring-shutter/20';

/** An admin action waiting for confirmation. */
type PendingAction = 'suspend' | 'reactivate' | 'hide' | 'show';

// ===================== PREVIEW =====================

/** `?preview` in development: sample reports, no login, actions only change this page. */
const PREVIEW_LIST: AdminReportsList = {
  openCount: 2,
  items: [
    {
      id: 201,
      target: 'message',
      reason: 'scam',
      description: 'Asked for the deposit by bank transfer before any visit.',
      status: 'aperta',
      createdAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
      reporter: { id: 'preview-r1', name: 'Lukas Becker', email: 'lukas@example.com' },
      reportedUser: { id: 'preview-u1', name: 'Mario Rossi', email: 'mario@example.com', accountStatus: 'attivo', isAdmin: false, totalReports: 3 },
      listing: { id: 11, title: 'Camera luminosa Città Studi', active: true },
      conversationId: 77,
      messageText: 'Per bloccare la stanza mandami 500€ di caparra su IT60 X054 2811 1010 0000 0123 456, poi ci vediamo.',
      handledAt: null,
      adminNote: null,
    },
    {
      id: 202,
      target: 'listing',
      reason: 'fake_listing',
      description: null,
      status: 'aperta',
      createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
      reporter: { id: 'preview-r2', name: 'Ana Souza', email: 'ana@example.com' },
      reportedUser: { id: 'preview-u2', name: 'Paola Neri', email: 'paola@example.com', accountStatus: 'attivo', isAdmin: false, totalReports: 1 },
      listing: { id: 12, title: 'Singola con bagno privato', active: true },
      conversationId: null,
      messageText: null,
      handledAt: null,
      adminNote: null,
    },
  ],
};

const PREVIEW_MESSAGES: AdminReportMessages = [
  { id: 1, from: 'reporter', body: 'Ciao! La stanza è ancora disponibile? Posso visitarla sabato?', sentAt: new Date(Date.now() - 7 * 3_600_000).toISOString() },
  { id: 2, from: 'reported', body: 'Sì, ma ci sono altri interessati.', sentAt: new Date(Date.now() - 6 * 3_600_000).toISOString() },
  { id: 3, from: 'reported', body: PREVIEW_LIST.items[0].messageText ?? '', sentAt: new Date(Date.now() - 6 * 3_600_000).toISOString() },
];

// ===================== PAGE =====================

export function AdminReportsPage() {
  const { t } = useLanguage();
  const preview = isVerificationPreview();
  const [status, setStatus] = useState<ReportStatus>('aperta');
  const query = useAdminReports(status, !preview);
  const [previewList, setPreviewList] = useState(PREVIEW_LIST);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const list = preview ? { ...previewList, items: previewList.items.filter((item) => item.status === status) } : query.data;
  const items = useMemo(() => list?.items ?? [], [list]);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  // Keep a selection: the first report of the list when nothing (or something gone) is selected.
  useEffect(() => {
    if (!items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  /** Preview only: applies a change to the sample report. */
  const previewUpdate = (id: number, change: (item: AdminReport) => AdminReport) =>
    setPreviewList((current) => {
      const nextItems = current.items.map((item) => (item.id === id ? change(item) : item));
      return { items: nextItems, openCount: nextItems.filter((item) => item.status === 'aperta').length };
    });

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8 lg:py-12">
        {preview ? (
          <p className="mb-6 rounded-xl bg-sun/30 px-4 py-2.5 text-sm font-bold text-ink" role="note">
            {t('verification.previewBanner')}
          </p>
        ) : null}
        <PageIntro eyebrow={t('adminReports.title')} title={t('adminReports.title')} description={t('adminReports.subtitle')} />

        <div className="mb-5 flex flex-wrap gap-2" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.status}
              type="button"
              role="tab"
              aria-selected={status === tab.status}
              onClick={() => setStatus(tab.status)}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-extrabold transition-colors',
                status === tab.status ? 'border-shutter bg-shutter text-mint-mist' : 'border-field bg-paper text-pine hover:bg-mint-mist',
              )}
              data-testid={`${ADMIN_REPORT_TEST_IDS.TAB_PREFIX}${tab.status}`}
            >
              {t(tab.label)}
              {tab.status === 'aperta' && list ? (
                <span className="rounded-full bg-sun px-2 py-0.5 text-xs text-ink tabular-nums">{list.openCount}</span>
              ) : null}
            </button>
          ))}
        </div>

        {!preview && query.isLoading ? (
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-[480px] rounded-2xl" />
          </div>
        ) : !preview && query.isError ? (
          <QueryError onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <p className="surface rounded-2xl px-6 py-14 text-center text-sm font-bold text-sage">{t('adminReports.empty')}</p>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr]">
            <ul className="surface divide-y divide-line overflow-hidden rounded-2xl">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    aria-current={item.id === selectedId}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                      item.id === selectedId ? 'bg-mint-mist' : 'hover:bg-cream',
                    )}
                    data-testid={`${ADMIN_REPORT_TEST_IDS.ROW_PREFIX}${item.id}`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-terracotta-mist text-terracotta">
                      <Flag size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-pine">
                        {item.reportedUser?.name ?? t('adminReports.deletedAccount')}
                      </span>
                      <span className="block truncate text-xs font-bold text-sage">
                        {t(`adminReports.target.${item.target}` as TranslationKey)} · {t(`safety.reason.${item.reason}` as TranslationKey)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {selected ? (
              <ReportDetail key={selected.id} item={selected} preview={preview} onPreviewUpdate={previewUpdate} />
            ) : (
              <p className="surface rounded-2xl px-6 py-14 text-center text-sm font-bold text-sage">{t('adminReports.select')}</p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ===================== DETAIL =====================

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-sage">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold text-ink">{children}</dd>
    </div>
  );
}

function ReportDetail({
  item,
  preview,
  onPreviewUpdate,
}: {
  item: AdminReport;
  preview: boolean;
  onPreviewUpdate: (id: number, change: (item: AdminReport) => AdminReport) => void;
}) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { resolve, setUserSuspended, setListingActive } = useAdminReportActions();
  const dateTimeFormat = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }), [language]);
  const [note, setNote] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const conversation = useAdminReportMessages(item.id, showConversation && !preview && item.conversationId !== null);

  const formatDateTime = (value: string | null) => (value ? dateTimeFormat.format(new Date(value)) : '—');
  const open = item.status === 'aperta';
  const reported = item.reportedUser;
  const suspended = reported?.accountStatus === ACCOUNT_SUSPENDED;
  const busy = resolve.isPending || setUserSuspended.isPending || setListingActive.isPending;
  const messages = preview ? PREVIEW_MESSAGES : conversation.data;

  const fail = () => toast({ title: t('adminReports.error'), variant: 'destructive' });

  /** Runs the confirmed action (suspend / reactivate / hide / show). */
  async function runPendingAction() {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    try {
      if (action === 'suspend' || action === 'reactivate') {
        if (!reported) return;
        const nextSuspended = action === 'suspend';
        if (preview) {
          onPreviewUpdate(item.id, (current) => ({
            ...current,
            reportedUser: current.reportedUser && { ...current.reportedUser, accountStatus: nextSuspended ? ACCOUNT_SUSPENDED : 'attivo' },
          }));
        } else {
          await setUserSuspended.mutateAsync({ userId: reported.id, suspended: nextSuspended });
        }
      } else {
        if (!item.listing) return;
        const active = action === 'show';
        if (preview) {
          onPreviewUpdate(item.id, (current) => ({ ...current, listing: current.listing && { ...current.listing, active } }));
        } else {
          await setListingActive.mutateAsync({ listingId: item.listing.id, active });
        }
      }
      toast({ title: t('adminReports.done') });
    } catch {
      fail();
    }
  }

  /** Closes the report as resolved or dismissed. */
  async function close(status: 'risolta' | 'archiviata') {
    const trimmed = note.trim() || undefined;
    try {
      if (preview) {
        onPreviewUpdate(item.id, (current) => ({
          ...current,
          status,
          handledAt: new Date().toISOString(),
          adminNote: trimmed ?? null,
        }));
      } else {
        await resolve.mutateAsync({ id: item.id, status, note: trimmed });
      }
      toast({ title: t('adminReports.done') });
    } catch {
      fail();
    }
  }

  const confirmTexts: Record<PendingAction, { title: string; text: string }> = {
    suspend: { title: t('adminReports.suspendTitle').replace('{name}', reported?.name ?? ''), text: t('adminReports.suspendText') },
    reactivate: { title: t('adminReports.reactivateTitle').replace('{name}', reported?.name ?? ''), text: t('adminReports.reactivateText') },
    hide: { title: t('adminReports.hideTitle'), text: t('adminReports.hideText') },
    show: { title: t('adminReports.showTitle'), text: t('adminReports.showText') },
  };

  return (
    <article className="surface rounded-2xl p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-pine">{t(`safety.reason.${item.reason}` as TranslationKey)}</h2>
          <p className="mt-1 text-sm font-bold text-sage">
            {t(`adminReports.target.${item.target}` as TranslationKey)} · {t('adminReports.reportedAt')} {formatDateTime(item.createdAt)}
          </p>
        </div>
        <StatusPill status={item.status} />
      </header>

      {/* ---------- People ---------- */}
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <Fact label={t('adminReports.reportedUser')}>
          {reported ? (
            <>
              <span className="block truncate">{reported.name}</span>
              <span className="block truncate text-xs text-sage">{reported.email ?? '—'}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-extrabold',
                    suspended ? 'bg-terracotta-mist text-terracotta' : 'bg-mint-mist text-shutter',
                  )}
                >
                  {suspended ? t('adminReports.accountSuspended') : t('adminReports.accountActive')}
                </span>
                <span className="font-bold text-sage">{t('adminReports.totalReports').replace('{n}', String(reported.totalReports))}</span>
              </span>
            </>
          ) : (
            <span className="text-sage">{t('adminReports.deletedAccount')}</span>
          )}
        </Fact>
        <Fact label={t('adminReports.reporter')}>
          {item.reporter ? (
            <>
              <span className="block truncate">{item.reporter.name}</span>
              <span className="block truncate text-xs text-sage">{item.reporter.email ?? '—'}</span>
            </>
          ) : (
            <span className="text-sage">{t('adminReports.deletedAccount')}</span>
          )}
        </Fact>
      </dl>

      {/* ---------- What was reported ---------- */}
      {item.messageText ? (
        <figure className="mt-5">
          <figcaption className="text-xs font-extrabold uppercase tracking-[0.08em] text-sage">{t('adminReports.reportedMessage')}</figcaption>
          <blockquote className="mt-1.5 whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-mint-mist px-4 py-3 text-sm leading-6 text-pine">
            {item.messageText}
          </blockquote>
        </figure>
      ) : null}

      <div className="mt-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-sage">{t('adminReports.description')}</p>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-ink">
          {item.description || <span className="text-sage">{t('adminReports.noDescription')}</span>}
        </p>
      </div>

      {item.listing ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-cream px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-sage">{t('adminReports.listing')}</p>
            <p className="truncate text-sm font-black text-pine">{item.listing.title}</p>
            <p className="text-xs font-bold text-sage">
              {item.listing.active ? t('adminReports.listingVisible') : t('adminReports.listingHidden')}
            </p>
          </div>
          {item.listing.active ? (
            <Link
              href={APP_ROUTES.LISTING_DETAIL.replace(':id', String(item.listing.id))}
              className="text-sm font-extrabold text-shutter hover:underline"
            >
              {t('adminReports.openListing')}
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* ---------- Reported conversation ---------- */}
      {item.conversationId !== null ? (
        <section className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-sage">{t('adminReports.conversation')}</p>
            {!showConversation ? (
              <Button
                variant="secondary"
                onClick={() => setShowConversation(true)}
                className="h-10"
                data-testid={ADMIN_REPORT_TEST_IDS.BUTTON_CONVERSATION}
              >
                <MessageSquareText size={16} aria-hidden /> {t('adminReports.showConversation')}
              </Button>
            ) : null}
          </div>
          {!showConversation ? (
            <p className="mt-1 text-xs font-bold text-sage">{t('adminReports.conversationHint')}</p>
          ) : !preview && conversation.isLoading ? (
            <Skeleton className="mt-3 h-40 rounded-2xl" />
          ) : !preview && conversation.isError ? (
            <div className="mt-3">
              <QueryError onRetry={() => void conversation.refetch()} />
            </div>
          ) : messages && messages.length ? (
            <ol className="mt-3 max-h-[420px] space-y-2 overflow-y-auto rounded-2xl border border-hairline bg-paper p-4">
              {messages.map((message) => (
                <li key={message.id} className={cn('flex flex-col', message.from === 'reporter' ? 'items-end' : 'items-start')}>
                  <span className="text-[11px] font-extrabold text-sage">
                    {t(`adminReports.from.${message.from}` as TranslationKey)} · {formatDateTime(message.sentAt)}
                  </span>
                  <p
                    className={cn(
                      'mt-0.5 max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-6',
                      message.from === 'reported' && 'bg-mint-mist text-pine',
                      message.from === 'reporter' && 'bg-shutter text-mint-mist',
                      (message.from === 'system' || message.from === 'deleted') && 'bg-cream italic text-sage',
                    )}
                  >
                    {message.from === 'deleted' ? t('messages.deletedMessage') : message.body}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm font-bold text-sage">{t('adminReports.noMessages')}</p>
          )}
        </section>
      ) : null}

      {/* ---------- Admin actions (also on closed reports: an account may need reactivating later) ---------- */}
      <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
        {reported && !reported.isAdmin ? (
          <Button
            variant="outline"
            onClick={() => setPendingAction(suspended ? 'reactivate' : 'suspend')}
            disabled={busy}
            className={cn(!suspended && 'border-terracotta/40 text-terracotta hover:border-terracotta hover:bg-terracotta-mist')}
            data-testid={ADMIN_REPORT_TEST_IDS.BUTTON_SUSPEND}
          >
            {suspended ? <UserRoundCheck size={16} aria-hidden /> : <Ban size={16} aria-hidden />}
            {suspended ? t('adminReports.reactivate') : t('adminReports.suspend')}
          </Button>
        ) : null}
        {item.listing ? (
          <Button
            variant="outline"
            onClick={() => setPendingAction(item.listing?.active ? 'hide' : 'show')}
            disabled={busy}
            data-testid={ADMIN_REPORT_TEST_IDS.BUTTON_LISTING}
          >
            {item.listing.active ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            {item.listing.active ? t('adminReports.hideListing') : t('adminReports.showListing')}
          </Button>
        ) : null}
      </div>
      {reported?.isAdmin ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-sage">
          <UserRound size={14} aria-hidden /> {t('adminReports.adminAccount')}
        </p>
      ) : null}

      {/* ---------- Close the report ---------- */}
      {open ? (
        <div className="mt-6 space-y-3 border-t border-line pt-5">
          <div className="space-y-2">
            <Label htmlFor="report-note">{t('adminReports.noteLabel')}</Label>
            <textarea
              id="report-note"
              rows={3}
              maxLength={REPORT_ADMIN_NOTE_MAX_LENGTH}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={TEXTAREA_CLASS}
              data-testid={ADMIN_REPORT_TEST_IDS.INPUT_NOTE}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void close('risolta')} disabled={busy} className="px-6" data-testid={ADMIN_REPORT_TEST_IDS.BUTTON_RESOLVE}>
              {resolve.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <CircleCheck size={16} aria-hidden />}
              {t('adminReports.resolve')}
            </Button>
            <Button variant="outline" onClick={() => void close('archiviata')} disabled={busy} data-testid={ADMIN_REPORT_TEST_IDS.BUTTON_DISMISS}>
              {t('adminReports.dismiss')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 border-t border-line pt-5 text-sm text-ink">
          <p>
            <span className="font-extrabold">{t('adminReports.handledAt')}:</span> {formatDateTime(item.handledAt)}
          </p>
          {item.adminNote ? <p className="mt-1 whitespace-pre-wrap text-sage">{item.adminNote}</p> : null}
        </div>
      )}

      <AlertDialog open={pendingAction !== null} onOpenChange={(value) => !value && setPendingAction(null)}>
        <AlertDialogContent className="w-[300px] sm:w-[420px]">
          {pendingAction ? (
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmTexts[pendingAction].title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmTexts[pendingAction].text}</AlertDialogDescription>
            </AlertDialogHeader>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('adminReports.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void runPendingAction()}
              className={cn((pendingAction === 'suspend' || pendingAction === 'hide') && 'bg-terracotta text-paper hover:bg-terracotta/90')}
              data-testid={ADMIN_REPORT_TEST_IDS.BUTTON_CONFIRM}
            >
              {t('adminReports.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

function StatusPill({ status }: { status: ReportStatus }) {
  const { t } = useLanguage();
  const styles: Record<ReportStatus, { className: string; label: TranslationKey }> = {
    aperta: { className: 'bg-sun/40 text-ink', label: 'adminReports.tabOpen' },
    risolta: { className: 'bg-mint-mist text-shutter', label: 'adminReports.tabResolved' },
    archiviata: { className: 'bg-cream text-sage', label: 'adminReports.tabDismissed' },
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold', styles[status].className)}>
      {t(styles[status].label)}
    </span>
  );
}
