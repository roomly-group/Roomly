import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, MessageCircle } from 'lucide-react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getListConversationsQueryKey } from '@workspace/api-client-react';
import type { StudentContractStage, StudentJourneyItem, StudentPastContractItem } from '@workspace/api-zod';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useFormat } from '@/hooks/use-format';
import { useToast } from '@/hooks/use-toast';
import { useCancelConversation } from '@/hooks/use-cancel-conversation';
import { getStudentContractQueryKey, useStudentContract } from '@/hooks/use-student-contract';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { EmptyState } from '@/components/shared/empty-state';
import { QueryError } from '@/components/shared/query-error';
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

// "Il mio contratto": the student's side of a rental, from the request to the
// stay. Everything shown comes from GET /api/me/contract (real requests and
// contracts). Steps Roomly does not handle yet (payments, e-signature, entry
// report) are not shown: the owner manages contract and registration by hand.

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];
type Translate = ReturnType<typeof useLanguage>['t'];

// ===================== CONFIGURATION =====================

/** Stable selectors for the student's contract page. */
const STUDENT_CONTRACT_TEST_IDS = {
  LINK_CHAT: 'link-contract-chat',
  BUTTON_CANCEL_REQUEST: 'button-cancel-request',
  BUTTON_CONFIRM_CANCEL: 'button-confirm-cancel-request',
  BUTTON_OTHER_PREFIX: 'button-other-journey-',
  BUTTON_PAST_TOGGLE: 'button-past-contracts',
  LINK_FIND_ROOM: 'link-contract-find-room',
} as const;

/** The step bar, in order. */
const STEPS: { stage: StudentContractStage; label: TranslationKey }[] = [
  { stage: 'request', label: 'studentContract.stepRequest' },
  { stage: 'sign', label: 'studentContract.stepSign' },
  { stage: 'move_in', label: 'studentContract.stepMoveIn' },
  { stage: 'stay', label: 'studentContract.stepStay' },
];

/** Contract steps after the signature (the rental is running or about to). */
const SIGNED_STATUSES = ['firmato', 'registrato'] as const;

const CARD_CLASS = 'rounded-2xl border border-pine/10 bg-paper shadow-rest';
const CARD_TITLE_CLASS = 'text-lg font-black tracking-[-0.03em] text-pine';
const BUTTON_CLASS =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black transition-colors active:scale-[.98]';
/** Button styles, all from the theme tokens (see components/shared/button.tsx). */
const BUTTON_TONES = {
  amber: 'bg-sun text-ink hover:bg-sun-hover',
  secondary: 'bg-mint-mist text-pine hover:bg-mint-wash',
  danger: 'border border-terracotta/30 bg-paper text-terracotta hover:border-terracotta hover:bg-terracotta-mist',
} as const;
const DESTRUCTIVE_ACTION_CLASS = 'bg-terracotta text-paper hover:bg-terracotta/90';

/** Status pills: solid on the pine panel, tinted (with a dot) on light cards. */
type PillTone = 'sun' | 'mint';
const PILL_DARK_CLASS: Record<PillTone, string> = {
  sun: 'bg-sun text-ink',
  mint: 'bg-mint-mist text-pine',
};
const PILL_LIGHT_CLASS: Record<PillTone, { badge: string; dot: string }> = {
  sun: { badge: 'bg-sun/15 text-amber-ink', dot: 'bg-sun' },
  mint: { badge: 'bg-mint-mist text-pine', dot: 'bg-shutter' },
};

// ===================== HELPERS =====================

/** Replaces {name}-style placeholders in a translated text. */
const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

const isSigned = (journey: StudentJourneyItem) =>
  Boolean(journey.contract && (SIGNED_STATUSES as readonly string[]).includes(journey.contract.status));

const chatHrefOf = (journey: StudentJourneyItem) =>
  journey.conversationId != null ? `${APP_ROUTES.MESSAGES}/${journey.conversationId}` : null;

/** Text and colour of a journey's status pill. */
function pillOf(journey: StudentJourneyItem, today: string): { label: TranslationKey; tone: PillTone; date?: string } {
  const contract = journey.contract;
  switch (journey.stage) {
    case 'request':
      return { label: 'studentContract.pillPending', tone: 'sun' };
    case 'sign':
      if (contract?.status === 'in_attesa_firma') return { label: 'studentContract.pillToSign', tone: 'sun' };
      return { label: contract ? 'studentContract.pillPreparing' : 'studentContract.pillAccepted', tone: 'mint' };
    case 'move_in':
      return contract && contract.startDate !== today
        ? { label: 'studentContract.pillMoveInOn', tone: 'sun', date: contract.startDate }
        : { label: 'studentContract.pillMoveInToday', tone: 'sun' };
    default:
      return { label: 'studentContract.pillActive', tone: 'mint' };
  }
}

/** Date formatters for this page: long in sentences, short ("13 nov") in lists. */
function useDates() {
  const format = useFormat();
  return {
    long: (value: string) => format.longDate(value),
    // A YYYY-MM-DD date is read at midday, so no time zone can move it to the day before.
    short: (value: string) => format.date(value.length === 10 ? `${value}T12:00:00` : value),
    price: format.price,
    monthYear: format.monthYear,
  };
}

// ===================== PIECES =====================

/** Richiesta · Firma · Ingresso · Soggiorno, with the current step in amber. */
function StepBar({ stage }: { stage: StudentContractStage }) {
  const { t } = useLanguage();
  const currentIndex = STEPS.findIndex((step) => step.stage === stage);
  return (
    <ol aria-label={t('studentContract.stepsLabel')} className="mb-6 grid grid-cols-4 gap-2">
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        return (
          <li key={step.stage} aria-current={state === 'current' ? 'step' : undefined} className="min-w-0">
            <span
              aria-hidden
              className={cn('block h-1.5 rounded-full', state === 'done' ? 'bg-shutter' : state === 'current' ? 'bg-sun' : 'bg-line')}
            />
            <span className={cn('mt-2 block truncate text-xs sm:text-sm', state === 'current' ? 'font-black text-ink' : 'font-bold text-sage')}>
              {t(step.label)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StatusPill({ journey, today, light = false }: { journey: StudentJourneyItem; today: string; light?: boolean }) {
  const { t } = useLanguage();
  const dates = useDates();
  const pill = pillOf(journey, today);
  const text = pill.date ? fill(t(pill.label), { date: dates.short(pill.date) }) : t(pill.label);
  if (light) {
    return (
      <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black', PILL_LIGHT_CLASS[pill.tone].badge)}>
        <span className={cn('h-1.5 w-1.5 rounded-full', PILL_LIGHT_CLASS[pill.tone].dot)} aria-hidden />
        {text}
      </span>
    );
  }
  return (
    <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-black', PILL_DARK_CLASS[pill.tone])}>
      {text}
    </span>
  );
}

/** The Deep Pine panel at the top: where the student is right now. */
function HeroPanel({
  title,
  subtitle,
  pill,
  children,
}: {
  title: string;
  subtitle: string;
  pill: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="on-dark rounded-2xl bg-pine p-6 text-mint-mist sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-black tracking-[-0.03em] text-mint-mist sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-mint-wash">{subtitle}</p>}
        </div>
        {pill}
      </div>
      {children}
    </section>
  );
}

const HeroDivider = () => <hr className="my-5 border-mint-mist/15" />;

function ChatLink({ href, tone, label, className }: { href: string; tone: keyof typeof BUTTON_TONES; label: string; className?: string }) {
  return (
    <Link href={href} className={cn(BUTTON_CLASS, BUTTON_TONES[tone], className)} data-testid={STUDENT_CONTRACT_TEST_IDS.LINK_CHAT}>
      <MessageCircle size={17} aria-hidden /> {label}
    </Link>
  );
}

type TimelineState = 'done' | 'current' | 'todo';
type TimelineItem = { key: string; label: string; meta?: string; state: TimelineState };

/** "A che punto siamo": every step from the accepted request to moving in. */
function buildTimeline(journey: StudentJourneyItem, today: string, t: Translate, short: (value: string) => string): TimelineItem[] {
  const contract = journey.contract;
  const signed = isSigned(journey);
  const sent = signed || contract?.status === 'in_attesa_firma';
  return [
    {
      key: 'accepted',
      label: t('studentContract.tlAccepted'),
      state: 'done',
      meta: journey.acceptedAt ? short(journey.acceptedAt) : undefined,
    },
    {
      key: 'prepared',
      label: t('studentContract.tlPrepared'),
      state: sent ? 'done' : 'current',
      meta: sent ? (contract?.signatureRequestedAt ? short(contract.signatureRequestedAt) : undefined) : t('studentContract.metaInProgress'),
    },
    {
      key: 'signed',
      label: t('studentContract.tlSigned'),
      state: signed ? 'done' : sent ? 'current' : 'todo',
      meta: signed ? (contract?.signedOn ? short(contract.signedOn) : undefined) : sent ? t('studentContract.metaNow') : undefined,
    },
    {
      key: 'registered',
      label: t('studentContract.tlRegistered'),
      state: contract?.registeredOn ? 'done' : 'todo',
      meta: contract?.registeredOn ? short(contract.registeredOn) : t('studentContract.metaByOwner'),
    },
    {
      key: 'move-in',
      label: t('studentContract.tlMoveIn'),
      state: journey.stage === 'move_in' ? 'current' : 'todo',
      meta: contract ? (contract.startDate === today ? t('studentContract.metaToday') : short(contract.startDate)) : undefined,
    },
  ];
}

function StepDot({ state, number }: { state: TimelineState; number?: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black',
        state === 'done' && 'bg-shutter text-mint-mist',
        state === 'current' && 'bg-sun text-ink',
        state === 'todo' && 'border-2 border-field text-sage',
      )}
    >
      {state === 'done' ? <Check size={16} strokeWidth={3} /> : number}
    </span>
  );
}

function TimelineCard({ items }: { items: TimelineItem[] }) {
  const { t } = useLanguage();
  return (
    <section className={cn(CARD_CLASS, 'p-6')}>
      <h2 className={CARD_TITLE_CLASS}>{t('studentContract.progressTitle')}</h2>
      <ol className="mt-4 space-y-4">
        {items.map((item) => (
          <li key={item.key} aria-current={item.state === 'current' ? 'step' : undefined} className="flex items-center gap-3">
            <StepDot state={item.state} />
            <span
              className={cn(
                'min-w-0 flex-1 leading-6',
                item.state === 'done' && 'font-extrabold text-sage',
                item.state === 'current' && 'font-black text-ink',
                item.state === 'todo' && 'font-extrabold text-ink',
              )}
            >
              {item.label}
            </span>
            {item.meta && <span className="shrink-0 text-right text-sm text-sage">{item.meta}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** "In parole semplici": the contract terms in one glance. */
function TermsCard({ journey, chatHref }: { journey: StudentJourneyItem; chatHref: string | null }) {
  const { t } = useLanguage();
  const dates = useDates();
  const contract = journey.contract;
  if (!contract) return null;

  const rows: { label: string; value: string }[] = [
    { label: t('studentContract.termRent'), value: fill(t('studentContract.termRentValue'), { price: dates.price(contract.monthlyRent) }) },
    {
      label: t('studentContract.termPeriod'),
      value: `${dates.long(contract.startDate)} – ${dates.long(contract.endDate)} · ${fill(t('contracts.months'), { n: contract.months })}`,
    },
  ];
  if (contract.deposit != null) rows.push({ label: t('studentContract.termDeposit'), value: dates.price(contract.deposit) });
  rows.push({ label: t('studentContract.termType'), value: t('studentContract.termTypeValue') });
  if (isSigned(journey)) {
    rows.push({
      label: t('studentContract.termRegistration'),
      value: contract.registeredOn
        ? fill(t('studentContract.termRegisteredOn'), { date: dates.long(contract.registeredOn) })
        : t('studentContract.termRegistrationByOwner'),
    });
  }
  // Before signing, the student can still ask for changes.
  const canAskChange = !isSigned(journey) && chatHref;

  return (
    <section className={cn(CARD_CLASS, 'p-6')}>
      <h2 className={CARD_TITLE_CLASS}>{t('studentContract.termsTitle')}</h2>
      <dl className="mt-3 divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-sm text-sage">{row.label}</dt>
            <dd className="min-w-0 text-right text-sm font-black text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      {canAskChange && (
        <p className="mt-4 text-sm leading-6 text-sage">
          {t('studentContract.askChange')}{' '}
          <Link href={chatHref} className="font-extrabold text-shutter underline underline-offset-4 hover:text-pine">
            {t('studentContract.askChangeLink')}
          </Link>
        </p>
      )}
    </section>
  );
}

/** Request stage: what happens next, the chat and the cancel button. */
function RequestDetails({ journey, onCancel }: { journey: StudentJourneyItem; onCancel: () => void }) {
  const { t } = useLanguage();
  const chatHref = chatHrefOf(journey);
  const steps: TranslationKey[] = ['studentContract.next1', 'studentContract.next2', 'studentContract.next3'];
  return (
    <>
      <section className={cn(CARD_CLASS, 'p-6')}>
        <h2 className={CARD_TITLE_CLASS}>{t('studentContract.nextTitle')}</h2>
        <ol className="mt-4 space-y-4">
          {steps.map((step, index) => (
            <li key={step} aria-current={index === 0 ? 'step' : undefined} className="flex items-start gap-3">
              <StepDot state={index === 0 ? 'current' : 'todo'} number={index + 1} />
              <span className={cn('pt-1 leading-6', index === 0 ? 'text-ink' : 'text-sage')}>{t(step)}</span>
            </li>
          ))}
        </ol>
      </section>

      {chatHref && (
        <div className="flex flex-col gap-3 rounded-2xl bg-mint-mist px-5 py-4 sm:flex-row sm:items-center">
          <MessageCircle size={20} className="hidden shrink-0 text-shutter sm:block" aria-hidden />
          <p className="min-w-0 flex-1 text-sm leading-6 text-pine-text">{t('studentContract.chatNote')}</p>
          <Link
            href={chatHref}
            className="inline-flex min-h-11 items-center justify-center self-start rounded-xl bg-shutter px-4 text-sm font-black text-mint-mist transition-colors hover:bg-pine sm:self-auto"
            data-testid={STUDENT_CONTRACT_TEST_IDS.LINK_CHAT}
          >
            {t('studentContract.openChat')}
          </Link>
        </div>
      )}

      {journey.conversationId != null && (
        <button
          type="button"
          onClick={onCancel}
          className={cn(BUTTON_CLASS, BUTTON_TONES.danger, 'w-full')}
          data-testid={STUDENT_CONTRACT_TEST_IDS.BUTTON_CANCEL_REQUEST}
        >
          {t('studentContract.cancelRequest')}
        </button>
      )}
    </>
  );
}

/** The selected rental: hero panel plus the cards of its stage. */
function JourneyView({ journey, today, onCancel }: { journey: StudentJourneyItem; today: string; onCancel: () => void }) {
  const { t } = useLanguage();
  const dates = useDates();
  const contract = journey.contract;
  const chatHref = chatHrefOf(journey);
  const pill = <StatusPill journey={journey} today={today} />;
  const roomLine = [journey.roomTitle, journey.roomAddress].filter(Boolean).join(' · ');
  const ownerWithBadge = journey.ownerVerified ? `${journey.ownerName} (${t('studentContract.verifiedOwner')})` : journey.ownerName;

  if (journey.stage === 'request') {
    return (
      <div className="space-y-4">
        <HeroPanel title={journey.roomTitle} subtitle={journey.roomAddress} pill={pill}>
          <HeroDivider />
          <h3 className="text-lg font-black text-mint-mist">{t('studentContract.requestSentTitle')}</h3>
          <p className="mt-1 leading-6 text-mint-wash">
            {fill(t('studentContract.requestSentText'), {
              owner: ownerWithBadge,
              date: journey.requestedAt ? dates.long(journey.requestedAt) : '',
            })}
          </p>
        </HeroPanel>
        <RequestDetails journey={journey} onCancel={onCancel} />
      </div>
    );
  }

  if (journey.stage === 'stay' && contract) {
    const current = contract.currentMonth ?? 1;
    const monthLabel = fill(t('studentContract.monthOf'), { n: current, total: contract.months });
    return (
      <div className="space-y-4">
        <HeroPanel title={journey.roomTitle} subtitle={journey.roomAddress} pill={pill}>
          <div className="mt-5">
            <div
              role="progressbar"
              aria-label={monthLabel}
              aria-valuemin={1}
              aria-valuemax={contract.months}
              aria-valuenow={current}
              className="h-2 overflow-hidden rounded-full bg-shutter"
            >
              <div className="h-full rounded-full bg-sun" style={{ width: `${Math.round((current / contract.months) * 100)}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-sm text-mint-wash">
              <span>{monthLabel}</span>
              <span>{fill(t('studentContract.until'), { date: dates.long(contract.endDate) })}</span>
            </div>
          </div>
          <HeroDivider />
          <div className="flex items-center gap-3">
            <Avatar name={journey.ownerName} src={journey.ownerPhotoUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-mint-mist">{journey.ownerName}</p>
              <p className="text-sm text-mint-wash">
                {journey.ownerVerified ? t('studentContract.verifiedOwnerTitle') : t('studentContract.ownerLabel')}
              </p>
            </div>
            {chatHref && (
              <Link
                href={chatHref}
                className={cn('inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black transition-colors', BUTTON_TONES.secondary)}
                data-testid={STUDENT_CONTRACT_TEST_IDS.LINK_CHAT}
              >
                {t('studentContract.write')}
              </Link>
            )}
          </div>
        </HeroPanel>
        <TermsCard journey={journey} chatHref={chatHref} />
        <section className={cn(CARD_CLASS, 'p-6')}>
          <h2 className={CARD_TITLE_CLASS}>{t('studentContract.endTitle')}</h2>
          <p className="mt-2 leading-6 text-ink">{fill(t('studentContract.endText'), { date: dates.long(contract.endDate) })}</p>
        </section>
      </div>
    );
  }

  const timeline = <TimelineCard items={buildTimeline(journey, today, t, dates.short)} />;

  if (journey.stage === 'move_in' && contract) {
    const startsToday = contract.startDate === today;
    return (
      <div className="space-y-4">
        <HeroPanel
          title={startsToday ? t('studentContract.moveInTodayTitle') : fill(t('studentContract.moveInTitle'), { date: dates.long(contract.startDate) })}
          subtitle={roomLine}
          pill={pill}
        >
          <p className="mt-4 leading-6 text-mint-wash">
            {contract.signedOn && `${fill(t('studentContract.signedOn'), { date: dates.long(contract.signedOn) })} `}
            {contract.registeredOn
              ? fill(t('studentContract.registeredOn'), { date: dates.long(contract.registeredOn) })
              : t('studentContract.registrationByOwner')}
          </p>
          {chatHref && <ChatLink href={chatHref} tone="secondary" label={t('studentContract.openChat')} className="mt-5" />}
        </HeroPanel>
        {timeline}
        <TermsCard journey={journey} chatHref={chatHref} />
      </div>
    );
  }

  // Sign stage: the contract is ready to sign, or the owner is still preparing it.
  if (contract?.status === 'in_attesa_firma') {
    return (
      <div className="space-y-4">
        <HeroPanel title={t('studentContract.readyTitle')} subtitle={roomLine} pill={pill}>
          <p className="mt-4 leading-6 text-mint-wash">
            {contract.signatureRequestedAt
              ? fill(t('studentContract.readyText'), { date: dates.long(contract.signatureRequestedAt) })
              : t('studentContract.readyTextNoDate')}
          </p>
          {chatHref && <ChatLink href={chatHref} tone="amber" label={t('studentContract.openChat')} className="mt-5 w-full" />}
        </HeroPanel>
        {timeline}
        <TermsCard journey={journey} chatHref={chatHref} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HeroPanel title={journey.roomTitle} subtitle={journey.roomAddress} pill={pill}>
        <HeroDivider />
        <h3 className="text-lg font-black text-mint-mist">{fill(t('studentContract.acceptedTitle'), { owner: journey.ownerName })}</h3>
        <p className="mt-1 leading-6 text-mint-wash">{t('studentContract.acceptedText')}</p>
        {chatHref && <ChatLink href={chatHref} tone="secondary" label={t('studentContract.openChat')} className="mt-5" />}
      </HeroPanel>
      {timeline}
      <TermsCard journey={journey} chatHref={chatHref} />
    </div>
  );
}

/** The student's other open rentals: tapping one shows it at the top. */
function OtherJourneys({
  items,
  today,
  onSelect,
}: {
  items: { journey: StudentJourneyItem; index: number }[];
  today: string;
  onSelect: (index: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <section className={cn(CARD_CLASS, 'overflow-hidden')}>
      <h2 className={cn(CARD_TITLE_CLASS, 'px-6 pb-2 pt-5')}>{t('studentContract.otherTitle')}</h2>
      <ul>
        {items.map(({ journey, index }) => (
          <li key={`${journey.conversationId ?? 'c'}-${journey.contract?.id ?? 'r'}`} className="border-t border-line first:border-t-0">
            <button
              type="button"
              onClick={() => onSelect(index)}
              className="flex min-h-11 w-full items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-mint-mist/40"
              data-testid={`${STUDENT_CONTRACT_TEST_IDS.BUTTON_OTHER_PREFIX}${index}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-black text-pine">{journey.roomTitle}</span>
                <span className="block truncate text-xs text-sage">{journey.roomAddress}</span>
              </span>
              <StatusPill journey={journey} today={today} light />
              <ChevronRight size={18} className="shrink-0 text-sage" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Contratti precedenti": closed by default, opens a simple list. */
function PastContracts({ items }: { items: StudentPastContractItem[] }) {
  const { t } = useLanguage();
  const dates = useDates();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="text-center">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 font-black text-shutter underline underline-offset-4 transition-colors hover:text-pine"
          data-testid={STUDENT_CONTRACT_TEST_IDS.BUTTON_PAST_TOGGLE}
        >
          {t('studentContract.pastToggle')}
          <ChevronDown size={18} className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      </div>
      {open && (
        <ul className={cn(CARD_CLASS, 'mt-3 overflow-hidden')}>
          {items.map((item) => (
            <li key={item.id} className="border-t border-line px-6 py-4 first:border-t-0">
              <p className="truncate font-black text-pine">{item.roomTitle}</p>
              <p className="truncate text-xs text-sage">{item.roomAddress}</p>
              <p className="mt-1 text-sm text-ink">
                {dates.monthYear(item.startDate)} – {dates.monthYear(item.endDate)}
                <span className="text-sage"> · {fill(t('contracts.nextEnded'), { date: dates.long(item.endedOn ?? item.endDate) })}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ===================== PAGE =====================

export function StudentContractPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const client = useQueryClient();
  const { data, isLoading, isError, refetch } = useStudentContract();
  const cancelConversation = useCancelConversation();
  const [selected, setSelected] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const journeys = data?.journeys ?? [];
  // The list can shrink after a refresh (e.g. a cancelled request): fall back to the first one.
  const selectedIndex = selected < journeys.length ? selected : 0;
  const journey = journeys[selectedIndex];
  const others = journeys.map((item, index) => ({ journey: item, index })).filter((item) => item.index !== selectedIndex);

  const selectJourney = (index: number) => {
    setSelected(index);
    window.scrollTo({ top: 0 });
  };

  // Cancels the shown request (only possible while it is pending), then
  // refreshes this page and the inbox so both show the new state.
  const cancelRequest = async () => {
    if (journey?.conversationId == null) return;
    try {
      await cancelConversation.mutateAsync({ id: journey.conversationId });
      toast({ title: t('studentContract.cancelDone') });
    } catch {
      toast({ title: t('studentContract.cancelFailed'), variant: 'destructive' });
    } finally {
      setConfirmCancel(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: getStudentContractQueryKey() }),
        client.invalidateQueries({ queryKey: getListConversationsQueryKey() }),
      ]);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[720px] px-5 pb-16 pt-8 lg:pt-10">
        <PageIntro eyebrow={t('nav.contracts')} title={t('studentContract.title')} />

        {isLoading ? (
          <div className="space-y-4" aria-hidden>
            <div className="skeleton h-8 rounded-xl" />
            <div className="skeleton h-52 rounded-2xl" />
            <div className="skeleton h-40 rounded-2xl" />
          </div>
        ) : isError || !data ? (
          <QueryError onRetry={() => void refetch()} />
        ) : (
          <div className="space-y-6">
            {journey ? (
              <div>
                <StepBar stage={journey.stage} />
                <JourneyView journey={journey} today={data.today} onCancel={() => setConfirmCancel(true)} />
              </div>
            ) : (
              <EmptyState
                title={t('contracts.emptyTitle')}
                text={t('studentContract.emptyText')}
                action={
                  <Link
                    href={APP_ROUTES.HOME}
                    className="inline-flex min-h-12 items-center rounded-xl bg-shutter px-5 text-sm font-black text-mint-mist transition-colors hover:bg-pine"
                    data-testid={STUDENT_CONTRACT_TEST_IDS.LINK_FIND_ROOM}
                  >
                    {t('nav.findRoom')}
                  </Link>
                }
              />
            )}

            {others.length > 0 && <OtherJourneys items={others} today={data.today} onSelect={selectJourney} />}
            {data.pastContracts.length > 0 && <PastContracts items={data.pastContracts} />}
            {journey && <p className="text-xs leading-5 text-sage">{t('studentContract.footnote')}</p>}
          </div>
        )}
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="w-[300px] sm:w-[350px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('studentContract.cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('studentContract.cancelText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('studentContract.cancelKeep')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void cancelRequest()}
              disabled={cancelConversation.isPending}
              className={DESTRUCTIVE_ACTION_CLASS}
              data-testid={STUDENT_CONTRACT_TEST_IDS.BUTTON_CONFIRM_CANCEL}
            >
              {t('studentContract.cancelConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
