import { useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronRight, Clock, Download, FileText, MessageCircle, Plus, Search, X } from 'lucide-react';
import { Link } from 'wouter';
import type { ContractAction, ContractCandidateItem, ContractGroup, OwnerContractItem } from '@workspace/api-zod';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES } from '@/lib/constants';
import { useFormat } from '@/hooks/use-format';
import { useToast } from '@/hooks/use-toast';
import {
  ownerContractsExportUrl,
  useCreateOwnerContract,
  useOwnerContracts,
  useUpdateOwnerContractStatus,
} from '@/hooks/use-owner-contracts';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { QueryError } from '@/components/shared/query-error';
import { Button } from '@/components/shared/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Stable selectors for the contract page. */
const OWNER_CONTRACTS_TEST_IDS = {
  LINK_EXPORT: 'link-export-contracts',
  BUTTON_NEW: 'button-new-contract',
  TAB_PREFIX: 'tab-contracts-',
  INPUT_SEARCH: 'input-search-contracts',
  ROW_PREFIX: 'row-contract-',
  BUTTON_ALERT_VIEW: 'button-alert-view-contract',
  BUTTON_ACTION_PREFIX: 'button-contract-action-',
  BUTTON_CONFIRM: 'button-contract-confirm',
  BUTTON_CREATE: 'button-create-contract',
} as const;

/** Filter tabs in display order ("all" plus the backend's groups). */
const TABS: { key: 'all' | ContractGroup; label: TranslationKey }[] = [
  { key: 'all', label: 'contracts.tabAll' },
  { key: 'active', label: 'contracts.tabActive' },
  { key: 'to_sign', label: 'contracts.tabToSign' },
  { key: 'expiring', label: 'contracts.tabExpiring' },
  { key: 'ended', label: 'contracts.tabEnded' },
];

/** Actions offered for each status, in display order. */
const ACTIONS_BY_STATUS: Record<OwnerContractItem['status'], ContractAction[]> = {
  bozza: ['send_for_signature', 'mark_signed', 'cancel'],
  in_attesa_firma: ['mark_signed', 'cancel'],
  firmato: ['mark_registered', 'mark_ended'],
  registrato: ['mark_ended'],
  concluso: [],
  annullato: [],
};

const ACTION_LABELS: Record<ContractAction, TranslationKey> = {
  send_for_signature: 'contracts.actionSend',
  mark_signed: 'contracts.actionSigned',
  mark_registered: 'contracts.actionRegistered',
  mark_ended: 'contracts.actionEnded',
  cancel: 'contracts.actionCancel',
};

/** Date field shown before confirming an action (actions without one confirm straight away). */
const ACTION_DATE_LABELS: Partial<Record<ContractAction, TranslationKey>> = {
  mark_signed: 'contracts.signedDate',
  mark_registered: 'contracts.registeredDate',
  mark_ended: 'contracts.endedDate',
};

const TABLE_GRID_CLASS = 'lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,1fr)_88px_minmax(0,1fr)_minmax(0,1.3fr)_20px] lg:items-center lg:gap-4';
const CARD_CLASS = 'rounded-2xl border border-pine/10 bg-paper shadow-rest';
const DIALOG_CONTENT_CLASS =
  'fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-[20px] bg-paper pb-[env(safe-area-inset-bottom)] shadow-float data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-6 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-0 sm:data-[state=open]:slide-in-from-bottom-2';

// ===================== HELPERS =====================

/** Replaces {name}-style placeholders in a translated text. */
const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

type Tone = 'neutral' | 'mint' | 'sun' | 'terracotta' | 'muted';

/** Badge text and colour: the step that needs attention wins over the period. */
function statusBadge(contract: OwnerContractItem): { label: TranslationKey; tone: Tone } {
  if (contract.status === 'bozza') return { label: 'contracts.statusDraft', tone: 'neutral' };
  if (contract.status === 'in_attesa_firma') return { label: 'contracts.statusWaiting', tone: 'neutral' };
  if (contract.status === 'annullato') return { label: 'contracts.statusCancelled', tone: 'muted' };
  if (contract.group === 'ended') return { label: 'contracts.statusEnded', tone: 'muted' };
  if (contract.status === 'firmato') return { label: 'contracts.statusToRegister', tone: 'sun' };
  if (contract.group === 'expiring') return { label: 'contracts.statusExpiring', tone: 'terracotta' };
  return { label: 'contracts.statusActive', tone: 'mint' };
}

const TONE_CLASS: Record<Tone, { badge: string; dot: string }> = {
  neutral: { badge: 'bg-cream text-pine', dot: 'bg-sage' },
  mint: { badge: 'bg-mint-mist text-pine', dot: 'bg-shutter' },
  sun: { badge: 'bg-sun/15 text-amber-ink', dot: 'bg-sun' },
  terracotta: { badge: 'bg-terracotta-mist text-terracotta', dot: 'bg-terracotta' },
  muted: { badge: 'bg-cream text-sage', dot: 'bg-sage-placeholder' },
};

function StatusBadge({ contract }: { contract: OwnerContractItem }) {
  const { t } = useLanguage();
  const { label, tone } = statusBadge(contract);
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black', TONE_CLASS[tone].badge)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', TONE_CLASS[tone].dot)} aria-hidden />
      {t(label)}
    </span>
  );
}

/** "Prossimo passo": what the owner has to do next, or the last thing that happened. */
function useNextStep() {
  const { t } = useLanguage();
  const format = useFormat();
  return (contract: OwnerContractItem): string => {
    switch (contract.status) {
      case 'bozza':
        return t('contracts.nextDraft');
      case 'in_attesa_firma':
        return contract.signatureRequestedAt
          ? fill(t('contracts.nextWaitingSince'), { date: format.longDate(contract.signatureRequestedAt) })
          : t('contracts.statusWaiting');
      case 'annullato':
        return t('contracts.nextCancelled');
      default:
        break;
    }
    if (contract.group === 'ended') return fill(t('contracts.nextEnded'), { date: format.longDate(contract.endedOn ?? contract.endDate) });
    if (contract.status === 'firmato' && contract.registrationDeadline) {
      return fill(t('contracts.nextRegister'), { date: format.longDate(contract.registrationDeadline) });
    }
    if (contract.group === 'expiring') return fill(t('contracts.nextExpiring'), { date: format.longDate(contract.endDate) });
    return contract.registeredOn ? fill(t('contracts.nextRegistered'), { date: format.longDate(contract.registeredOn) }) : '';
  };
}

// ===================== PIECES =====================

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className={cn(CARD_CLASS, 'px-5 py-4')}>
      <p className="text-sm font-extrabold text-pine">{label}</p>
      <p className={cn('mt-1.5 text-[34px] font-black leading-none tracking-[-0.04em] tabular-nums', accent ? 'text-terracotta' : 'text-pine')}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-sage">{hint}</p>
    </div>
  );
}

function ContractRow({ contract, onOpen }: { contract: OwnerContractItem; onOpen: () => void }) {
  const { t } = useLanguage();
  const format = useFormat();
  const nextStep = useNextStep();
  const studentMeta = [contract.studentUniversity, contract.studentCourse].filter(Boolean).join(' · ');

  return (
    <li className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={onOpen}
        className={cn(TABLE_GRID_CLASS, 'flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-mint-mist/40')}
        data-testid={`${OWNER_CONTRACTS_TEST_IDS.ROW_PREFIX}${contract.id}`}
      >
        <div className="flex w-full items-start justify-between gap-3 lg:block">
          <div className="min-w-0">
            <p className="truncate font-black text-pine">{contract.roomTitle}</p>
            <p className="truncate text-xs text-sage">{contract.roomAddress}</p>
          </div>
          <span className="lg:hidden">
            <StatusBadge contract={contract} />
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={contract.studentName} src={contract.studentPhotoUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-ink">{contract.studentName}</p>
            {studentMeta && <p className="truncate text-xs text-sage">{studentMeta}</p>}
          </div>
        </div>
        <div className="flex items-baseline gap-3 lg:block">
          <p className="text-sm text-ink">
            {format.monthYear(contract.startDate)} – {format.monthYear(contract.endDate)}
          </p>
          <p className="text-xs text-sage">{fill(t('contracts.months'), { n: contract.months })}</p>
          <p className="ml-auto text-sm font-black tabular-nums text-ink lg:hidden">
            {format.price(contract.monthlyRent)}
            <span className="font-bold text-sage">{t('contracts.perMonth')}</span>
          </p>
        </div>
        <p className="hidden text-sm font-black tabular-nums text-ink lg:block">{format.price(contract.monthlyRent)}</p>
        <span className="hidden lg:block">
          <StatusBadge contract={contract} />
        </span>
        <p className="text-xs leading-5 text-sage lg:text-ink">{nextStep(contract)}</p>
        <ChevronRight size={18} className="hidden text-sage lg:block" aria-hidden />
      </button>
    </li>
  );
}

function DialogShell({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content aria-describedby={undefined} className={DIALOG_CONTENT_CLASS}>
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
            <DialogPrimitive.Title className="text-lg font-black tracking-[-0.03em] text-pine">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label={t('searchBar.close')}
              className="grid h-11 w-11 place-items-center rounded-full text-pine transition-colors hover:bg-mint-mist"
            >
              <X size={20} aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function NewContractDialog({
  open,
  onOpenChange,
  candidates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: ContractCandidateItem[];
}) {
  const { t } = useLanguage();
  const format = useFormat();
  const { toast } = useToast();
  const createContract = useCreateOwnerContract();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');

  const pick = (candidate: ContractCandidateItem) => {
    setConversationId(candidate.conversationId);
    setStartDate(candidate.suggestedStartDate ?? '');
    setEndDate(candidate.suggestedEndDate ?? '');
    setRent(String(candidate.suggestedMonthlyRent || ''));
    setDeposit('');
  };

  const reset = (next: boolean) => {
    if (!next) setConversationId(null);
    onOpenChange(next);
  };

  const invalidPeriod = Boolean(startDate && endDate && endDate <= startDate);
  const canSubmit = conversationId != null && startDate && endDate && !invalidPeriod && rent !== '' && Number(rent) >= 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || conversationId == null) return;
    try {
      await createContract.mutateAsync({
        conversationId,
        startDate,
        endDate,
        monthlyRent: Number(rent),
        deposit: deposit === '' ? null : Number(deposit),
      });
      reset(false);
    } catch {
      toast({ title: t('messages.actionFailed'), description: t('contracts.createFailed'), variant: 'destructive' });
    }
  };

  return (
    <DialogShell open={open} onOpenChange={reset} title={t('contracts.newTitle')}>
      {candidates.length === 0 ? (
        <p className="text-sm leading-6 text-sage">{t('contracts.newNoCandidates')}</p>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-extrabold text-pine">{t('contracts.newRequest')}</legend>
            <ul className="space-y-2">
              {candidates.map((candidate) => {
                const selected = candidate.conversationId === conversationId;
                return (
                  <li key={candidate.conversationId}>
                    <button
                      type="button"
                      onClick={() => pick(candidate)}
                      aria-pressed={selected}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
                        selected ? 'border-shutter bg-mint-mist' : 'border-field hover:border-shutter',
                      )}
                    >
                      <Avatar name={candidate.studentName} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-pine">{candidate.studentName}</span>
                        <span className="block truncate text-xs text-sage">
                          {candidate.roomTitle} · {format.price(candidate.suggestedMonthlyRent)}
                          {t('contracts.perMonth')}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {conversationId != null && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="contract-start">{t('contracts.startDate')}</Label>
                  <Input id="contract-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contract-end">{t('contracts.endDate')}</Label>
                  <Input
                    id="contract-end"
                    type="date"
                    required
                    min={startDate || undefined}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    aria-invalid={invalidPeriod || undefined}
                  />
                </div>
              </div>
              {invalidPeriod && <p className="text-sm font-bold text-terracotta">{t('contracts.invalidPeriod')}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="contract-rent">{t('contracts.monthlyRent')}</Label>
                  <Input id="contract-rent" type="number" inputMode="decimal" min={0} step="1" required value={rent} onChange={(e) => setRent(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contract-deposit">{t('contracts.deposit')}</Label>
                  <Input id="contract-deposit" type="number" inputMode="decimal" min={0} step="1" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
                </div>
              </div>
              <Button
                type="submit"
                className="min-h-12 w-full"
                disabled={!canSubmit || createContract.isPending}
                data-testid={OWNER_CONTRACTS_TEST_IDS.BUTTON_CREATE}
              >
                {t('contracts.create')}
              </Button>
            </>
          )}
        </form>
      )}
    </DialogShell>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-t-0">
      <dt className="text-sm text-sage">{label}</dt>
      <dd className="text-right text-sm font-extrabold text-ink">{value}</dd>
    </div>
  );
}

function ContractDialog({ contract, today, onClose }: { contract: OwnerContractItem | null; today: string; onClose: () => void }) {
  const { t } = useLanguage();
  const format = useFormat();
  const { toast } = useToast();
  const nextStep = useNextStep();
  const updateStatus = useUpdateOwnerContractStatus();
  const [action, setAction] = useState<ContractAction | null>(null);
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState('');

  const close = () => {
    setAction(null);
    setReference('');
    onClose();
  };

  const choose = (next: ContractAction) => {
    setAction(next);
    setDate(next === 'mark_ended' && contract && contract.endDate < today ? contract.endDate : today);
  };

  const futureDate = action != null && action !== 'mark_ended' && date > today;

  const confirm = async () => {
    if (!contract || !action) return;
    try {
      await updateStatus.mutateAsync({
        id: contract.id,
        action,
        date: ACTION_DATE_LABELS[action] ? date : undefined,
        registrationReference: action === 'mark_registered' ? reference : undefined,
      });
      setAction(null);
      setReference('');
    } catch {
      toast({ title: t('messages.actionFailed'), description: t('contracts.updateFailed'), variant: 'destructive' });
    }
  };

  const actions = contract ? ACTIONS_BY_STATUS[contract.status] : [];
  const dateLabel = action ? ACTION_DATE_LABELS[action] : undefined;

  return (
    <DialogShell open={contract != null} onOpenChange={(open) => !open && close()} title={contract?.roomTitle ?? ''}>
      {contract && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar name={contract.studentName} src={contract.studentPhotoUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-pine">{contract.studentName}</p>
              <p className="truncate text-xs text-sage">{contract.roomAddress}</p>
            </div>
            <StatusBadge contract={contract} />
          </div>

          <p className="rounded-xl bg-cream px-4 py-3 text-sm font-bold text-pine">{nextStep(contract)}</p>

          <dl>
            <DetailLine
              label={t('contracts.detailPeriod')}
              value={`${format.longDate(contract.startDate)} – ${format.longDate(contract.endDate)}`}
            />
            <DetailLine label={t('contracts.detailRent')} value={format.price(contract.monthlyRent)} />
            {contract.deposit != null && <DetailLine label={t('contracts.detailDeposit')} value={format.price(contract.deposit)} />}
            {contract.signedOn && <DetailLine label={t('contracts.detailSigned')} value={format.longDate(contract.signedOn)} />}
            {contract.registeredOn && <DetailLine label={t('contracts.detailRegistered')} value={format.longDate(contract.registeredOn)} />}
            {contract.registrationReference && <DetailLine label={t('contracts.detailReference')} value={contract.registrationReference} />}
            {contract.endedOn && <DetailLine label={t('contracts.detailEnded')} value={format.longDate(contract.endedOn)} />}
          </dl>

          {action ? (
            <div className="space-y-4 rounded-2xl border border-field p-4">
              <p className="font-black text-pine">{t(ACTION_LABELS[action])}</p>
              {action === 'cancel' && <p className="text-sm leading-6 text-sage">{t('contracts.cancelConfirm')}</p>}
              {dateLabel && (
                <div className="space-y-2">
                  <Label htmlFor="contract-action-date">{t(dateLabel)}</Label>
                  <Input
                    id="contract-action-date"
                    type="date"
                    required
                    max={action === 'mark_ended' ? undefined : today}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-invalid={futureDate || undefined}
                  />
                  {futureDate && <p className="text-sm font-bold text-terracotta">{t('contracts.futureDate')}</p>}
                </div>
              )}
              {action === 'mark_registered' && (
                <div className="space-y-2">
                  <Label htmlFor="contract-reference">{t('contracts.reference')}</Label>
                  <Input
                    id="contract-reference"
                    maxLength={120}
                    placeholder={t('contracts.referencePlaceholder')}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="min-h-11 flex-1" onClick={() => setAction(null)}>
                  {t('contracts.back')}
                </Button>
                <Button
                  className={cn('min-h-11 flex-1', action === 'cancel' && 'bg-terracotta text-paper hover:bg-terracotta/90')}
                  disabled={updateStatus.isPending || (dateLabel != null && !date) || futureDate}
                  onClick={() => void confirm()}
                  data-testid={OWNER_CONTRACTS_TEST_IDS.BUTTON_CONFIRM}
                >
                  {t('contracts.confirm')}
                </Button>
              </div>
            </div>
          ) : (
            actions.length > 0 && (
              <div className="flex flex-col gap-2">
                {actions.map((item, index) => (
                  <Button
                    key={item}
                    variant={item === 'cancel' ? 'ghost' : index === 0 ? 'primary' : 'outline'}
                    className={cn('min-h-11 w-full', item === 'cancel' && 'text-terracotta hover:bg-terracotta-mist')}
                    onClick={() => choose(item)}
                    data-testid={`${OWNER_CONTRACTS_TEST_IDS.BUTTON_ACTION_PREFIX}${item}`}
                  >
                    {t(ACTION_LABELS[item])}
                  </Button>
                ))}
              </div>
            )
          )}

          {contract.conversationId != null && (
            <Link
              href={`${APP_ROUTES.OWNER_MESSAGES}/${contract.conversationId}`}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-shutter transition-colors hover:text-pine"
            >
              <MessageCircle size={16} aria-hidden /> {t('contracts.openChat')}
            </Link>
          )}
        </div>
      )}
    </DialogShell>
  );
}

// ===================== PAGE =====================

export function OwnerContractsPage() {
  const { t } = useLanguage();
  const format = useFormat();
  const { data, isLoading, isError, refetch } = useOwnerContracts();
  const [tab, setTab] = useState<'all' | ContractGroup>('all');
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const contracts = useMemo(() => data?.contracts ?? [], [data]);
  const candidates = data?.candidates ?? [];
  const today = data?.today ?? new Date().toISOString().slice(0, 10);

  const counts = useMemo(() => {
    const byGroup: Record<ContractGroup, number> = { to_sign: 0, active: 0, expiring: 0, ended: 0 };
    let toRegister = 0;
    let rent = 0;
    for (const contract of contracts) {
      byGroup[contract.group] += 1;
      if (contract.status === 'firmato' && contract.group !== 'ended') toRegister += 1;
      if (contract.group === 'active' || contract.group === 'expiring') rent += contract.monthlyRent;
    }
    return { byGroup, toRegister, rent };
  }, [contracts]);

  // The signed contract whose registration deadline comes first.
  const urgent = useMemo(
    () =>
      contracts
        .filter((contract) => contract.registrationDeadline && contract.group !== 'ended')
        .sort((a, b) => (a.registrationDeadline ?? '').localeCompare(b.registrationDeadline ?? ''))[0],
    [contracts],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return contracts.filter(
      (contract) =>
        (tab === 'all' || contract.group === tab) &&
        (!needle || [contract.studentName, contract.roomTitle, contract.roomAddress].some((text) => text.toLowerCase().includes(needle))),
    );
  }, [contracts, tab, query]);

  const openContract = contracts.find((contract) => contract.id === openId) ?? null;
  const activeCount = counts.byGroup.active + counts.byGroup.expiring;
  const toComplete = counts.byGroup.to_sign + counts.toRegister;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8 lg:px-8 lg:pt-10">
        <PageIntro
          eyebrow={t('nav.contracts')}
          title={t('contracts.title')}
          description={t('contracts.subtitle')}
          action={
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              <a
                href={ownerContractsExportUrl}
                download
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-outline px-4 text-sm font-black text-pine transition-colors hover:border-shutter hover:bg-mint-mist"
                data-testid={OWNER_CONTRACTS_TEST_IDS.LINK_EXPORT}
              >
                <Download size={17} aria-hidden /> {t('contracts.export')}
              </a>
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-shutter px-5 text-sm font-black text-mint-mist transition-colors hover:bg-pine"
                data-testid={OWNER_CONTRACTS_TEST_IDS.BUTTON_NEW}
              >
                <Plus size={17} aria-hidden /> {t('contracts.new')}
              </button>
            </div>
          }
        />

        {isLoading ? (
          <div className="space-y-4" aria-hidden>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div className="skeleton h-32 rounded-2xl" key={item} />
              ))}
            </div>
            <div className="skeleton h-64 rounded-2xl" />
          </div>
        ) : isError || !data ? (
          <QueryError onRetry={() => void refetch()} />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label={t('contracts.statActive')}
                value={String(activeCount)}
                hint={fill(t('contracts.statActiveHint'), { n: data.publishedRooms })}
              />
              <StatCard label={t('contracts.statRent')} value={format.price(counts.rent)} hint={t('contracts.statRentHint')} />
              <StatCard
                label={t('contracts.statToComplete')}
                value={String(toComplete)}
                hint={fill(t('contracts.statToCompleteHint'), { sign: counts.byGroup.to_sign, register: counts.toRegister })}
              />
              <StatCard
                label={t('contracts.statExpiring')}
                value={String(counts.byGroup.expiring)}
                hint={counts.byGroup.expiring ? t('contracts.statExpiringHint') : t('contracts.statExpiringNone')}
                accent={counts.byGroup.expiring > 0}
              />
            </div>

            {urgent?.registrationDeadline && (
              <div className="flex flex-col gap-3 rounded-2xl border border-sun/40 bg-sun/10 px-5 py-4 sm:flex-row sm:items-center">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sun text-paper" aria-hidden>
                  <Clock size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-ink">
                    {fill(t(urgent.registrationDeadline < today ? 'contracts.alertOverdue' : 'contracts.alertTitle'), {
                      name: urgent.studentName,
                      date: format.longDate(urgent.registrationDeadline),
                    })}
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-amber-ink">{t('contracts.alertText')}</p>
                </div>
                <Button
                  variant="outline"
                  className="min-h-11 self-start border-transparent bg-paper sm:self-auto"
                  onClick={() => setOpenId(urgent.id)}
                  data-testid={OWNER_CONTRACTS_TEST_IDS.BUTTON_ALERT_VIEW}
                >
                  {t('contracts.view')}
                </Button>
              </div>
            )}

            {candidates.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl bg-mint-mist px-5 py-4 sm:flex-row sm:items-center">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-shutter text-mint-mist" aria-hidden>
                  <FileText size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-pine">{fill(t('contracts.candidatesTitle'), { n: candidates.length })}</p>
                  <p className="mt-0.5 text-sm leading-6 text-pine-text">{t('contracts.candidatesText')}</p>
                </div>
                <Button className="min-h-11 self-start sm:self-auto" onClick={() => setNewOpen(true)}>
                  <Plus size={16} aria-hidden /> {t('contracts.new')}
                </Button>
              </div>
            )}

            <section className={cn(CARD_CLASS, 'overflow-hidden')} aria-label={t('contracts.title')}>
              <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:pb-0" role="tablist">
                  {TABS.map((item) => {
                    const count = item.key === 'all' ? contracts.length : counts.byGroup[item.key];
                    const selected = tab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setTab(item.key)}
                        className={cn(
                          'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-black transition-colors',
                          selected ? 'border-pine bg-pine text-mint-mist' : 'border-line bg-paper text-pine hover:border-shutter',
                        )}
                        data-testid={`${OWNER_CONTRACTS_TEST_IDS.TAB_PREFIX}${item.key}`}
                      >
                        {t(item.label)}
                        <span
                          className={cn(
                            'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] tabular-nums',
                            selected ? 'bg-shutter text-mint-mist' : 'bg-cream text-sage',
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <label className="relative block lg:w-80">
                  <span className="sr-only">{t('contracts.search')}</span>
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sage" aria-hidden />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('contracts.search')}
                    className="h-11 rounded-full bg-cream pl-10"
                    data-testid={OWNER_CONTRACTS_TEST_IDS.INPUT_SEARCH}
                  />
                </label>
              </div>

              {contracts.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="font-black text-pine">{t('contracts.emptyTitle')}</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-sage">{t('contracts.emptyText')}</p>
                </div>
              ) : visible.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-sage">{t('contracts.noResults')}</p>
              ) : (
                <>
                  <div
                    className={cn(TABLE_GRID_CLASS, 'hidden border-b border-line bg-cream/60 px-5 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-sage')}
                    aria-hidden
                  >
                    <span>{t('contracts.colRoom')}</span>
                    <span>{t('contracts.colStudent')}</span>
                    <span>{t('contracts.colPeriod')}</span>
                    <span>{t('contracts.colRent')}</span>
                    <span>{t('contracts.colStatus')}</span>
                    <span>{t('contracts.colNext')}</span>
                    <span />
                  </div>
                  <ul>
                    {visible.map((contract) => (
                      <ContractRow key={contract.id} contract={contract} onOpen={() => setOpenId(contract.id)} />
                    ))}
                  </ul>
                </>
              )}
            </section>

            <p className="text-xs leading-5 text-sage">{t('contracts.footnote')}</p>
          </div>
        )}
      </div>

      <NewContractDialog open={newOpen} onOpenChange={setNewOpen} candidates={candidates} />
      <ContractDialog contract={openContract} today={today} onClose={() => setOpenId(null)} />
    </AppShell>
  );
}
