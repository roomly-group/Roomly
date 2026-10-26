import { useEffect, useState, type ReactNode } from 'react';
import { Link, Redirect } from 'wouter';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  Copy,
  GraduationCap,
  Instagram,
  KeyRound,
  MessageCircle,
  PhoneCall,
  Share2,
  Users,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Navbar } from '@/components/layout/navbar';
import { SiteFooter } from '@/components/layout/site-footer';
import { TikTokIcon } from '@/components/shared/brand-icons';
import { useOnboardingRedirect } from '@/components/RequireAuth';
import { patchAccount } from '@/lib/account-cache';
import { APP_ROUTES, SOCIAL_PROFILE_URLS, formatMonthYear, formatPrice } from '@/lib/constants';
import { COMMUNITY_GROUP_URL, INTERVIEW_BOOKING_URL, OPENING_MONTH } from '@/lib/launch-config';
import {
  editStepHref,
  fetchInvite,
  fetchOnboarding,
  inviteLink,
  type InviteData,
  type OnboardingData,
  type OnboardingExtraStep,
} from '@/lib/onboarding';

// ===================== CONFIGURATION =====================

/** How long "Link copiato" stays on the copy button (ms). */
const COPIED_FEEDBACK_MS = 2000 as const;

const DURATION_LABELS = {
  semestre: 'onboarding.duration.semestre',
  un_anno: 'onboarding.duration.un_anno',
  piu_anni: 'onboarding.duration.piu_anni',
  non_so: 'onboarding.duration.non_so',
} as const;

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** "2027-02" → Date, or null when the launch month is not set. */
function openingDate(): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(OPENING_MONTH);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : null;
}

/**
 * Where a student lands after signing up: the invite link that moves them up
 * the list (the position is only ever shown next to it), their search data to
 * confirm or complete, a way in for owners, and ways to stay in touch.
 */
export function WaitlistConfirmedPage() {
  const { t, language } = useLanguage();
  const unfinishedOnboarding = useOnboardingRedirect();
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [invite, setInvite] = useState<InviteData | null>(null);

  // Both hidden when their request fails (e.g. logged out): nothing is guessed.
  useEffect(() => {
    let active = true;
    fetchOnboarding()
      .then((data) => active && setOnboarding(data))
      .catch(() => undefined);
    fetchInvite()
      .then((data) => {
        if (!active) return;
        setInvite(data);
        // Same number everywhere (menus, profile) as on this page.
        patchAccount({ posizione: data.posizione });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (unfinishedOnboarding) return <Redirect to={APP_ROUTES.ONBOARDING} replace />;

  const opening = openingDate();
  const steps = [
    { icon: Check, title: t('waitlistConfirmed.step1Title'), text: t('waitlistConfirmed.step1Text') },
    { icon: Bell, title: t('waitlistConfirmed.step2Title'), text: t('waitlistConfirmed.step2Text') },
    { icon: KeyRound, title: t('waitlistConfirmed.step3Title'), text: t('waitlistConfirmed.step3Text') },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-cream text-ink">
      <header className="mx-auto flex h-20 w-full max-w-[1320px] items-center px-5 lg:px-8">
        <div className="w-full">
          <Navbar />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-16 lg:px-8">
        {/* Hero: confirmation and, when decided, the opening month. The position lives in the invite card. */}
        <section className="relative overflow-hidden rounded-[2rem] bg-mint-wash px-6 py-10 sm:px-12 sm:py-14">
          <div className="relative grid items-center gap-10 md:grid-cols-[1.15fr_1fr]">
            <div className="page-enter">
              <p className="inline-flex items-center gap-2 rounded-full bg-mint-mist px-3.5 py-1.5 text-xs font-extrabold text-pine">
                <span className="h-1.5 w-1.5 rounded-full bg-shutter" aria-hidden />
                {t('waitlistConfirmed.badge')}
              </p>
              <h1 className="display-heading mt-6 max-w-md text-[clamp(2.5rem,6vw,3.5rem)] text-pine">{t('waitlistConfirmed.title')}</h1>
              <p className="mt-4 max-w-md text-[16px] leading-7 text-pine-text">{t('waitlistConfirmed.subtitle')}</p>
              {opening ? (
                <p className="mt-6 inline-flex items-center gap-2 rounded-xl bg-paper px-4 py-2.5 text-[15px] font-black text-pine shadow-rest" data-testid="text-opening-month">
                  <CalendarDays size={18} className="text-shutter" aria-hidden />
                  {fill(t('waitlistConfirmed.openingMonth'), {
                    month: new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(opening),
                  })}
                </p>
              ) : null}
            </div>

            {invite ? <InviteCard invite={invite} /> : null}
          </div>
        </section>

        {onboarding ? <SearchSummary data={onboarding} /> : null}

        {/* Owners never wait in the list: they talk to the team straight away. */}
        <section className="mt-6 grid gap-6 rounded-[2rem] bg-sun px-6 py-8 sm:px-10 md:grid-cols-[1fr_auto] md:items-center" data-testid="panel-owners">
          <div>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-black leading-tight tracking-[-0.02em] text-ink">{t('waitlistConfirmed.ownersTitle')}</h2>
            <p className="mt-2 max-w-xl text-[15px] leading-6 text-ink">{t('waitlistConfirmed.ownersText')}</p>
          </div>
          <Link
            href={APP_ROUTES.CONTACT}
            className="inline-flex h-12 items-center justify-center gap-2 justify-self-start rounded-xl bg-shutter px-6 text-[15px] font-extrabold text-mint-mist transition-colors hover:bg-pine md:justify-self-end"
            data-testid="link-owners-contact"
          >
            {t('waitlistConfirmed.ownersCta')}
            <ArrowRight size={17} aria-hidden />
          </Link>
        </section>

        <div className={`mt-6 grid gap-6 ${INTERVIEW_BOOKING_URL ? 'md:grid-cols-2' : ''}`}>
          {INTERVIEW_BOOKING_URL ? (
            <ExternalCard
              icon={<PhoneCall size={20} />}
              title={t('waitlistConfirmed.interviewTitle')}
              text={t('waitlistConfirmed.interviewText')}
              cta={t('waitlistConfirmed.interviewCta')}
              href={INTERVIEW_BOOKING_URL}
              testId="link-interview"
            />
          ) : null}

          <section className="rounded-2xl border border-hairline bg-paper p-6 shadow-rest sm:p-7">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-mint-mist text-shutter" aria-hidden>
              <Users size={20} />
            </span>
            <h2 className="mt-4 text-lg font-black text-pine">{t('waitlistConfirmed.followTitle')}</h2>
            <p className="mt-1.5 text-[15px] leading-6 text-sage">{t('waitlistConfirmed.followText')}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <SocialLink href={SOCIAL_PROFILE_URLS.INSTAGRAM} icon={<Instagram size={17} />} label="Instagram" />
              <SocialLink href={SOCIAL_PROFILE_URLS.TIKTOK} icon={<TikTokIcon size={15} />} label="TikTok" />
              {COMMUNITY_GROUP_URL ? (
                <SocialLink href={COMMUNITY_GROUP_URL} icon={<MessageCircle size={17} />} label={t('waitlistConfirmed.communityGroup')} />
              ) : null}
            </div>
          </section>
        </div>

        <section className="mt-16" aria-labelledby="confirmed-next">
          <h2 id="confirmed-next" className="display-heading text-[clamp(2rem,4.4vw,2.75rem)] text-pine">
            {t('waitlistConfirmed.whatNextTitle')}
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="border-t border-line pt-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-mint-mist text-shutter" aria-hidden>
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-4 text-lg font-black text-pine">{step.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-6 text-sage">{step.text}</p>
                </li>
              );
            })}
          </ol>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/** University, arrival and budget: shown to confirm, each one opens its onboarding question. */
function SearchSummary({ data }: { data: OnboardingData }) {
  const { t, language } = useLanguage();
  const arrival = data.arrivo_previsto
    ? formatMonthYear(new Date(`${data.arrivo_previsto}T00:00:00`), language)
    : data.durata_permanenza
      ? t(DURATION_LABELS[data.durata_permanenza])
      : null;
  const budget = data.preferenze?.budget_max != null
    ? fill(t('onboarding.budgetUpTo'), { price: formatPrice(Number(data.preferenze.budget_max), language) })
    : null;
  const tiles: { step: OnboardingExtraStep; icon: ReactNode; label: string; value: string | null }[] = [
    { step: 'university', icon: <GraduationCap size={18} />, label: t('onboarding.universityLabel'), value: data.universita },
    { step: 'arrival', icon: <CalendarDays size={18} />, label: t('waitlistConfirmed.searchArrival'), value: arrival },
    { step: 'budget', icon: <Wallet size={18} />, label: t('waitlistConfirmed.searchBudget'), value: budget },
  ];

  return (
    <section className="mt-6 rounded-2xl border border-hairline bg-paper p-6 shadow-rest sm:p-8" data-testid="panel-search-summary">
      <h2 className="text-lg font-black text-pine">{t('waitlistConfirmed.searchTitle')}</h2>
      <p className="mt-1.5 max-w-2xl text-[15px] leading-6 text-sage">{t('waitlistConfirmed.searchText')}</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.step}>
            <Link
              href={editStepHref(tile.step, 'waitlist')}
              className={`flex h-full flex-col gap-1 rounded-xl border px-4 py-3.5 transition-colors hover:border-shutter hover:bg-mint-mist ${
                tile.value ? 'border-line bg-cream' : 'border-dashed border-outline bg-paper'
              }`}
              data-testid={`link-search-${tile.step}`}
            >
              <span className="flex items-center gap-2 text-xs font-extrabold text-sage">
                <span className="text-shutter" aria-hidden>{tile.icon}</span>
                {tile.label}
              </span>
              <span className={`text-[15px] font-black ${tile.value ? 'text-pine' : 'text-shutter'}`}>
                {tile.value ?? t('waitlistConfirmed.searchAdd')}
              </span>
              <span className="text-xs font-bold text-sage">{tile.value ? t('waitlistConfirmed.searchEdit') : ' '}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Position plus the mechanism to improve it: personal link, WhatsApp, native share. */
function InviteCard({ invite }: { invite: InviteData }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const link = inviteLink(invite.codice);
  const message = fill(t('waitlistConfirmed.inviteShareText'), { link });
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Clipboard blocked: the link stays selectable in the field.
    }
  }

  return (
    <div className="rounded-2xl border border-pine/10 bg-paper p-6 shadow-float sm:p-7" data-testid="panel-invite">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-sage">{t('waitlistConfirmed.positionLabel')}</p>
          <p className="mt-1 text-[56px] font-black leading-none tracking-[-0.05em] tabular-nums text-pine" data-testid="text-position">
            {invite.posizione !== null ? `#${invite.posizione}` : '—'}
          </p>
        </div>
        {invite.invitati > 0 ? (
          <p className="rounded-full bg-mint-mist px-3 py-1.5 text-xs font-extrabold text-pine">
            {fill(t('waitlistConfirmed.inviteCount'), { count: invite.invitati })}
          </p>
        ) : null}
      </div>

      <h2 className="mt-5 text-lg font-black text-pine">{t('waitlistConfirmed.inviteTitle')}</h2>
      <p className="mt-1 text-sm leading-6 text-sage">{fill(t('waitlistConfirmed.inviteText'), { bonus: invite.bonus })}</p>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-field bg-cream py-1.5 pl-3.5 pr-1.5">
        <input
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          aria-label={t('waitlistConfirmed.inviteLinkLabel')}
          className="min-w-0 flex-1 truncate bg-transparent text-sm font-bold text-ink outline-none"
          data-testid="input-invite-link"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-shutter px-3 text-sm font-extrabold text-mint-mist transition-colors hover:bg-pine"
          data-testid="button-copy-invite"
        >
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          {copied ? t('waitlistConfirmed.inviteCopied') : t('waitlistConfirmed.inviteCopy')}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-outline px-4 text-sm font-extrabold text-pine transition-colors hover:border-shutter hover:bg-mint-mist"
          data-testid="link-invite-whatsapp"
        >
          <MessageCircle size={16} aria-hidden />
          WhatsApp
        </a>
        {canShare ? (
          <button
            type="button"
            onClick={() => void navigator.share({ text: message }).catch(() => undefined)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-outline px-4 text-sm font-extrabold text-pine transition-colors hover:border-shutter hover:bg-mint-mist"
            data-testid="button-invite-share"
          >
            <Share2 size={16} aria-hidden />
            {t('waitlistConfirmed.inviteShare')}
          </button>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-sage">{t('waitlistConfirmed.inviteInstagramHint')}</p>
    </div>
  );
}

function ExternalCard({ icon, title, text, cta, href, testId }: { icon: ReactNode; title: string; text: string; cta: string; href: string; testId: string }) {
  return (
    <section className="rounded-2xl border border-hairline bg-paper p-6 shadow-rest sm:p-7">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-mint-mist text-shutter" aria-hidden>
        {icon}
      </span>
      <h2 className="mt-4 text-lg font-black text-pine">{title}</h2>
      <p className="mt-1.5 text-[15px] leading-6 text-sage">{text}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-shutter px-5 text-sm font-extrabold text-mint-mist transition-colors hover:bg-pine"
        data-testid={testId}
      >
        {cta}
        <ArrowRight size={16} aria-hidden />
      </a>
    </section>
  );
}

function SocialLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-outline px-4 text-sm font-extrabold text-pine transition-colors hover:border-shutter hover:bg-mint-mist"
    >
      <span aria-hidden>{icon}</span>
      {label}
    </a>
  );
}

export default WaitlistConfirmedPage;
