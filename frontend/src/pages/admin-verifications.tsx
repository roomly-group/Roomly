import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CircleAlert, Clock, Loader2, ShieldCheck, ShieldX, UserRound } from 'lucide-react';
import {
  VERIFICATION_REJECTION_REASONS,
  VERIFICATION_REVIEWER_NOTE_MAX_LENGTH,
  type AdminVerification,
  type AdminVerificationsList,
  type VerificationRejectionReason,
  type VerificationStatus,
} from '@workspace/api-zod';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAdminVerifications, useDecideVerification } from '@/hooks/use-verification';
import { isVerificationPreview } from '@/pages/verification';
import { AppShell } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { QueryError } from '@/components/shared/query-error';
import { Button } from '@/components/shared/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

// Reviewers' page (/admin/verifiche, admins only): attempts waiting for review
// on the left, the selected one on the right with the document photos, the
// video, the expected code and gestures, and Approve / Reject. Every decision
// is also a training label for the Roomly verification model.
// Backend: GET/POST /api/admin/verifications (routes/verification.ts).

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Filter tabs in display order. */
const TABS: { status: Exclude<VerificationStatus, 'bozza'>; label: TranslationKey }[] = [
  { status: 'in_attesa', label: 'adminVerification.tabPending' },
  { status: 'approvata', label: 'adminVerification.tabApproved' },
  { status: 'rifiutata', label: 'adminVerification.tabRejected' },
];

/** Stable selectors for the reviewers' page. */
const ADMIN_VERIFICATION_TEST_IDS = {
  TAB_PREFIX: 'tab-verifications-',
  ROW_PREFIX: 'row-verification-',
  BUTTON_APPROVE: 'button-approve-verification',
  BUTTON_REJECT: 'button-reject-verification',
  SELECT_REASON: 'select-rejection-reason',
  INPUT_NOTE: 'input-reviewer-note',
  BUTTON_CONFIRM_REJECT: 'button-confirm-reject',
} as const;

const TEXTAREA_CLASS =
  'w-full rounded-xl border border-field bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-shutter focus:ring-2 focus:ring-shutter/20';

// ===================== PREVIEW =====================

/** A drawn stand-in for a document photo, so the preview has something to show. */
const PREVIEW_DOCUMENT_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540"><rect width="856" height="540" rx="32" fill="#E1F5EE"/><rect x="48" y="120" width="220" height="280" rx="16" fill="#9FC9B8"/><rect x="310" y="140" width="440" height="28" rx="8" fill="#085041"/><rect x="310" y="200" width="320" height="22" rx="8" fill="#527067"/><rect x="310" y="250" width="380" height="22" rx="8" fill="#527067"/><rect x="48" y="440" width="760" height="22" rx="6" fill="#0F6E56"/></svg>',
)}`;

const PREVIEW_LIST: AdminVerificationsList = {
  pendingCount: 2,
  items: [
    {
      id: 101,
      status: 'in_attesa',
      userId: 'preview-1',
      firstName: 'Giulia',
      lastName: 'Esposito',
      email: 'giulia@example.com',
      birthDate: '1979-04-12',
      isOwner: true,
      documentType: 'carta_identita',
      challengeCode: '4729',
      challengeGestures: ['turn_left', 'document_next_to_face'],
      consentTraining: true,
      frontUrl: PREVIEW_DOCUMENT_URL,
      backUrl: PREVIEW_DOCUMENT_URL,
      videoUrl: null,
      submittedAt: new Date(Date.now() - 3_600_000).toISOString(),
      decidedAt: null,
      rejectionReason: null,
      reviewerNote: null,
      filesDeletedAt: null,
    },
    {
      id: 102,
      status: 'in_attesa',
      userId: 'preview-2',
      firstName: 'Lukas',
      lastName: 'Becker',
      email: 'lukas@example.com',
      birthDate: '2003-09-30',
      isOwner: false,
      documentType: 'passaporto',
      challengeCode: '0815',
      challengeGestures: ['smile', 'tilt_document'],
      consentTraining: false,
      frontUrl: PREVIEW_DOCUMENT_URL,
      backUrl: null,
      videoUrl: null,
      submittedAt: new Date(Date.now() - 7_200_000).toISOString(),
      decidedAt: null,
      rejectionReason: null,
      reviewerNote: null,
      filesDeletedAt: null,
    },
  ],
};

// ===================== PAGE =====================

export function AdminVerificationsPage() {
  const { t } = useLanguage();
  const preview = isVerificationPreview();
  const [status, setStatus] = useState<Exclude<VerificationStatus, 'bozza'>>('in_attesa');
  const query = useAdminVerifications(status, !preview);
  const [previewList, setPreviewList] = useState(PREVIEW_LIST);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const list = preview
    ? { ...previewList, items: previewList.items.filter((item) => item.status === status) }
    : query.data;
  const items = useMemo(() => list?.items ?? [], [list]);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  // Keep a selection: the first attempt of the list when nothing (or something gone) is selected.
  useEffect(() => {
    if (!items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  const previewDecide = (id: number, approve: boolean, reason?: VerificationRejectionReason, note?: string) =>
    setPreviewList((current) => ({
      pendingCount: Math.max(0, current.pendingCount - 1),
      items: current.items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: approve ? 'approvata' : 'rifiutata',
              decidedAt: new Date().toISOString(),
              rejectionReason: approve ? null : reason ?? null,
              reviewerNote: note ?? null,
            }
          : item,
      ),
    }));

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8 lg:py-12">
        {preview ? (
          <p className="mb-6 rounded-xl bg-sun/30 px-4 py-2.5 text-sm font-bold text-ink" role="note">
            {t('verification.previewBanner')}
          </p>
        ) : null}
        <PageIntro eyebrow={t('adminVerification.title')} title={t('adminVerification.title')} description={t('adminVerification.subtitle')} />

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
              data-testid={`${ADMIN_VERIFICATION_TEST_IDS.TAB_PREFIX}${tab.status}`}
            >
              {t(tab.label)}
              {tab.status === 'in_attesa' && list ? (
                <span className="rounded-full bg-sun px-2 py-0.5 text-xs text-ink tabular-nums">{list.pendingCount}</span>
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
          <p className="surface rounded-2xl px-6 py-14 text-center text-sm font-bold text-sage">{t('adminVerification.empty')}</p>
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
                    data-testid={`${ADMIN_VERIFICATION_TEST_IDS.ROW_PREFIX}${item.id}`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper text-pine">
                      <UserRound size={18} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-pine">{fullName(item)}</span>
                      <span className="block truncate text-xs font-bold text-sage">
                        {item.isOwner ? t('adminVerification.owner') : t('adminVerification.student')} ·{' '}
                        {t(`verification.docType.${item.documentType}` as TranslationKey)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {selected ? (
              <VerificationDetail
                key={selected.id}
                item={selected}
                preview={preview}
                onPreviewDecide={previewDecide}
              />
            ) : (
              <p className="surface rounded-2xl px-6 py-14 text-center text-sm font-bold text-sage">{t('adminVerification.select')}</p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function fullName(item: AdminVerification): string {
  return `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() || item.email || item.userId;
}

// ===================== DETAIL =====================

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-sage">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}

function MediaFrame({ label, children, missing }: { label: string; children: React.ReactNode; missing: boolean }) {
  const { t } = useLanguage();
  return (
    <figure className="overflow-hidden rounded-2xl border border-hairline bg-cream">
      <figcaption className="border-b border-hairline px-3 py-2 text-xs font-extrabold uppercase tracking-[0.08em] text-sage">{label}</figcaption>
      {missing ? (
        <p className="grid aspect-[4/3] place-items-center p-4 text-center text-sm font-bold text-sage">{t('adminVerification.fileMissing')}</p>
      ) : (
        children
      )}
    </figure>
  );
}

function VerificationDetail({
  item,
  preview,
  onPreviewDecide,
}: {
  item: AdminVerification;
  preview: boolean;
  onPreviewDecide: (id: number, approve: boolean, reason?: VerificationRejectionReason, note?: string) => void;
}) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  // The year matters here: it is what the reviewer compares with the document.
  const birthDateFormat = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'long' }), [language]);
  const decide = useDecideVerification();
  const dateTimeFormat = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }), [language]);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<VerificationRejectionReason>('document_unreadable');
  const [note, setNote] = useState('');

  const formatDateTime = (value: string | null) => (value ? dateTimeFormat.format(new Date(value)) : '—');
  const pending = item.status === 'in_attesa';

  async function send(approve: boolean) {
    const trimmed = note.trim() || undefined;
    if (preview) {
      onPreviewDecide(item.id, approve, approve ? undefined : reason, trimmed);
      toast({ title: t('adminVerification.decided') });
      return;
    }
    try {
      await decide.mutateAsync(
        approve ? { id: item.id, decision: 'approve' } : { id: item.id, decision: 'reject', reason, note: trimmed },
      );
      toast({ title: t('adminVerification.decided') });
    } catch {
      toast({ title: t('verification.error'), variant: 'destructive' });
    }
  }

  return (
    <article className="surface rounded-2xl p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-black tracking-[-0.03em] text-pine">{fullName(item)}</h2>
          <p className="mt-1 text-sm font-bold text-sage">
            {item.isOwner ? t('adminVerification.owner') : t('adminVerification.student')}
          </p>
        </div>
        <StatusPill item={item} />
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Fact label={t('adminVerification.email')} value={item.email ?? '—'} />
        <Fact label={t('adminVerification.birthDate')} value={item.birthDate ? birthDateFormat.format(new Date(`${item.birthDate}T00:00:00`)) : '—'} />
        <Fact label={t('adminVerification.document')} value={t(`verification.docType.${item.documentType}` as TranslationKey)} />
        <Fact label={t('adminVerification.submittedAt')} value={formatDateTime(item.submittedAt)} />
      </dl>

      <p className="mt-4 text-xs font-bold text-sage">
        {item.consentTraining ? t('adminVerification.trainingYes') : t('adminVerification.trainingNo')}
      </p>

      <div className="mt-5 rounded-2xl bg-pine p-4 text-mint-mist">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-mint-wash">{t('adminVerification.expectedCode')}</p>
            <p className="text-2xl font-black tracking-[0.08em] tabular-nums">Roomly {item.challengeCode}</p>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-mint-wash">{t('adminVerification.expectedGestures')}</p>
            <ol className="text-sm font-bold">
              {item.challengeGestures.map((gesture, position) => (
                <li key={gesture}>
                  {position + 1}. {t(`verification.gesture.${gesture}` as TranslationKey)}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {item.filesDeletedAt ? (
        <p className="mt-5 rounded-xl bg-cream px-4 py-3 text-sm font-bold text-sage">
          {t('adminVerification.filesDeleted')} · {formatDateTime(item.filesDeletedAt)}
        </p>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <MediaFrame label={t('adminVerification.front')} missing={!item.frontUrl}>
            <a href={item.frontUrl ?? undefined} target="_blank" rel="noreferrer">
              <img src={item.frontUrl ?? undefined} alt={t('adminVerification.front')} className="aspect-[4/3] w-full object-contain" />
            </a>
          </MediaFrame>
          <MediaFrame label={t('adminVerification.back')} missing={!item.backUrl}>
            <a href={item.backUrl ?? undefined} target="_blank" rel="noreferrer">
              <img src={item.backUrl ?? undefined} alt={t('adminVerification.back')} className="aspect-[4/3] w-full object-contain" />
            </a>
          </MediaFrame>
          <MediaFrame label={t('adminVerification.video')} missing={!item.videoUrl}>
            <video src={item.videoUrl ?? undefined} controls playsInline className="aspect-[4/3] w-full bg-ink object-contain" />
          </MediaFrame>
        </div>
      )}

      {pending ? (
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm font-extrabold text-pine">{t('adminVerification.checklist')}</p>
          <ul className="mt-2 grid gap-1.5 text-sm text-ink sm:grid-cols-2">
            {(['adminVerification.check1', 'adminVerification.check2', 'adminVerification.check3', 'adminVerification.check4'] as const).map(
              (key) => (
                <li key={key} className="flex items-start gap-2">
                  <BadgeCheck size={16} className="mt-0.5 shrink-0 text-shutter" aria-hidden />
                  {t(key)}
                </li>
              ),
            )}
          </ul>

          {rejecting ? (
            <div className="mt-5 space-y-4 rounded-2xl border border-terracotta/30 bg-terracotta-mist p-4">
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">{t('adminVerification.reasonLabel')}</Label>
                <select
                  id="rejection-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value as VerificationRejectionReason)}
                  className={TEXTAREA_CLASS}
                  data-testid={ADMIN_VERIFICATION_TEST_IDS.SELECT_REASON}
                >
                  {VERIFICATION_REJECTION_REASONS.map((value) => (
                    <option key={value} value={value}>
                      {t(`verification.reason.${value}` as TranslationKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewer-note">{t('adminVerification.noteLabel')}</Label>
                <textarea
                  id="reviewer-note"
                  rows={3}
                  maxLength={VERIFICATION_REVIEWER_NOTE_MAX_LENGTH}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className={TEXTAREA_CLASS}
                  data-testid={ADMIN_VERIFICATION_TEST_IDS.INPUT_NOTE}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => void send(false)}
                  disabled={decide.isPending}
                  className="bg-terracotta text-white hover:bg-terracotta/90"
                  data-testid={ADMIN_VERIFICATION_TEST_IDS.BUTTON_CONFIRM_REJECT}
                >
                  {decide.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldX size={16} aria-hidden />}
                  {t('adminVerification.confirmReject')}
                </Button>
                <Button variant="outline" onClick={() => setRejecting(false)} disabled={decide.isPending}>
                  {t('adminVerification.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={() => void send(true)}
                disabled={decide.isPending}
                className="px-6"
                data-testid={ADMIN_VERIFICATION_TEST_IDS.BUTTON_APPROVE}
              >
                {decide.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
                {t('adminVerification.approve')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setRejecting(true)}
                disabled={decide.isPending}
                data-testid={ADMIN_VERIFICATION_TEST_IDS.BUTTON_REJECT}
              >
                <ShieldX size={16} aria-hidden />
                {t('adminVerification.reject')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 border-t border-line pt-5 text-sm text-ink">
          <p>
            <span className="font-extrabold">{t('adminVerification.decidedAt')}:</span> {formatDateTime(item.decidedAt)}
          </p>
          {item.rejectionReason ? (
            <p className="mt-1">
              <span className="font-extrabold">{t('adminVerification.reasonLabel')}:</span>{' '}
              {t(`verification.reason.${item.rejectionReason}` as TranslationKey)}
            </p>
          ) : null}
          {item.reviewerNote ? <p className="mt-1 text-sage">{item.reviewerNote}</p> : null}
        </div>
      )}
    </article>
  );
}

function StatusPill({ item }: { item: AdminVerification }) {
  const { t } = useLanguage();
  if (item.status === 'approvata') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-mist px-3 py-1 text-xs font-extrabold text-shutter">
        <BadgeCheck size={14} aria-hidden />
        {t('adminVerification.decisionApproved')}
      </span>
    );
  }
  if (item.status === 'rifiutata') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta-mist px-3 py-1 text-xs font-extrabold text-terracotta">
        <CircleAlert size={14} aria-hidden />
        {t('adminVerification.decisionRejected')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sun/40 px-3 py-1 text-xs font-extrabold text-ink">
      <Clock size={14} aria-hidden />
      {t('adminVerification.tabPending')}
    </span>
  );
}
