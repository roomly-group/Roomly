import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Redirect, useLocation } from 'wouter';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Camera,
  Ellipsis,
  Facebook,
  ImagePlus,
  Instagram,
  Linkedin,
  Loader2,
  Users,
} from 'lucide-react';
import {
  API_BASE_PATH,
  API_ROUTE_PATHS,
  ONBOARDING_OPTIONS,
  PROFILE_BIO_MAX_LENGTH_CHARS,
  USER_PREFERENCE_OPTIONS,
  type UserPreferences,
} from '@workspace/api-zod';
import { useLanguage } from '@/lib/i18n';
import { patchAccount } from '@/lib/account-cache';
import { mainPageFor } from '@/lib/auth-role';
import { peekLastKnownRole, peekRoleCache } from '@/lib/role-cache';
import {
  ONBOARDING_EXTRAS_QUERY,
  ONBOARDING_RETURN_PROFILE,
  ONBOARDING_RETURN_QUERY,
  ONBOARDING_EXTRA_STEPS,
  claimStoredInvite,
  fetchOnboarding,
  fromBoolean,
  isAdult,
  toBoolean,
  missingExtraSteps,
  type OnboardingData,
  type OnboardingExtraStep,
  type OnboardingSource,
  type YesNoAny,
} from '@/lib/onboarding';
import { APP_ROUTES } from '@/lib/constants';
import { PROFILE_PHOTO_ACCEPT, PhotoReadError, shrinkPhoto, uploadProfilePhoto } from '@/lib/profile-photo';
import { Button } from '@/components/shared/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BirthDatePicker } from '@/components/shared/birth-date-picker';
import { GoogleMonoIcon, TikTokIcon } from '@/components/shared/brand-icons';
import { ChipGroup, ChoiceCard, ChoiceChip } from '@/components/onboarding/choice';
import roomlyMark from '@assets/logo_no_background.png';

// The onboarding right after signup: one question per screen, a progress bar
// and the waitlist position at the top. Four required steps (name, how they
// found Roomly, date of birth, photo, which can be skipped), then a "you're on
// the list" screen, then two optional ones the student needs anyway once the
// app opens. Every answer is saved as soon as they press Continue, so leaving
// halfway never loses anything. Backend: routes/onboarding.ts.

// ===================== CONFIGURATION =====================

const REQUIRED_STEPS = ['name', 'source', 'birth', 'photo'] as const;
const EXTRA_STEPS = ONBOARDING_EXTRA_STEPS;
type RequiredStep = (typeof REQUIRED_STEPS)[number];
type ExtraStep = OnboardingExtraStep;
type Step = RequiredStep | 'milestone' | ExtraStep;

/** Steps that move the progress bar (the milestone screen sits between the two groups). */
const PROGRESS_STEPS: readonly Step[] = [...REQUIRED_STEPS, ...EXTRA_STEPS];
/** Where Continue leads; null = done, on to the waitlist page. */
const NEXT_STEP: Record<Step, Step | null> = {
  name: 'source',
  source: 'birth',
  birth: 'photo',
  photo: 'milestone',
  milestone: 'lifestyle',
  lifestyle: 'about',
  about: null,
};
const PREVIOUS_STEP: Partial<Record<Step, Step>> = {
  source: 'name',
  birth: 'source',
  photo: 'birth',
  lifestyle: 'milestone',
  about: 'lifestyle',
};

/** Smallest visible width of the progress bar, so step one is not an empty track (fraction). */
const MIN_PROGRESS = 0.04 as const;
/** `/onboarding?preview` in development: the whole flow with sample data, nothing saved, no login needed. */
const ONBOARDING_PREVIEW_QUERY = 'preview' as const;


type Source = OnboardingSource;

const SOURCE_ICONS: Record<Source, ReactNode> = {
  instagram: <Instagram size={26} strokeWidth={1.8} />,
  tiktok: <TikTokIcon size={23} />,
  linkedin: <Linkedin size={26} strokeWidth={1.8} />,
  amico: <Users size={26} strokeWidth={1.8} />,
  google: <GoogleMonoIcon size={22} />,
  ai: <Bot size={26} strokeWidth={1.8} />,
  facebook: <Facebook size={26} strokeWidth={1.8} />,
  altro: <Ellipsis size={26} strokeWidth={1.8} />,
};

const SOURCE_LABELS = {
  instagram: 'onboarding.source.instagram',
  tiktok: 'onboarding.source.tiktok',
  linkedin: 'onboarding.source.linkedin',
  amico: 'onboarding.source.amico',
  google: 'onboarding.source.google',
  ai: 'onboarding.source.ai',
  facebook: 'onboarding.source.facebook',
  altro: 'onboarding.source.altro',
} as const;

const NOISE_LABELS = {
  silenzioso: 'preferences.noise.silent',
  medio: 'preferences.noise.medium',
  tollerante: 'preferences.noise.tolerant',
} as const;
const CLEANLINESS_LABELS = {
  molto_ordinato: 'preferences.cleanliness.veryTidy',
  abbastanza_ordinato: 'preferences.cleanliness.tidy',
  tollerante: 'preferences.cleanliness.flexible',
} as const;
const SCHEDULE_LABELS = {
  notturno: 'preferences.schedule.night',
  diurno: 'preferences.schedule.day',
  flessibile: 'preferences.schedule.flexible',
} as const;
const STUDY_LABELS = {
  silenzioso: 'preferences.study.quiet',
  con_musica: 'preferences.study.music',
  flessibile: 'preferences.study.flexible',
} as const;

// ===================== DATA =====================

type OnboardingPatch = Partial<
  Pick<
    OnboardingData,
    | 'nome'
    | 'cognome'
    | 'data_nascita'
    | 'fonti_scoperta'
    | 'fonte_scoperta_altro'
    | 'bio'
  >
> & { preferenze?: Partial<UserPreferences>; completato?: true };

const PREVIEW_DATA: OnboardingData = {
  posizione: 128,
  nome: '',
  cognome: '',
  nome_suggerito: 'Mario',
  cognome_suggerito: 'Rossi',
  data_nascita: null,
  fonte_scoperta: null,
  fonti_scoperta: [],
  fonte_scoperta_altro: null,
  foto_profilo_url: null,
  universita: null,
  corso_di_studio: null,
  arrivo_previsto: null,
  durata_permanenza: null,
  bio: null,
  preferenze: null,
  onboarding_completato_at: null,
};

/** Dev-only preview of the flow (the router skips the login check for it). Always false in production builds. */
export function isOnboardingPreview() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has(ONBOARDING_PREVIEW_QUERY);
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_PATH}${path}`, { credentials: 'include', ...init });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return (await response.json()) as T;
}

/** Preview mode: apply a save locally, the way the backend would. */
function applyLocally(data: OnboardingData, patch: OnboardingPatch): OnboardingData {
  const { preferenze, completato, ...fields } = patch;
  return {
    ...data,
    ...fields,
    // Like the backend: the first answer also goes to fonte_scoperta.
    fonte_scoperta: fields.fonti_scoperta ? fields.fonti_scoperta[0] ?? null : data.fonte_scoperta,
    preferenze: preferenze ? ({ ...(data.preferenze ?? {}), ...preferenze } as UserPreferences) : data.preferenze,
    onboarding_completato_at: completato ? data.onboarding_completato_at ?? new Date().toISOString() : data.onboarding_completato_at,
  };
}

/** Questions that can be reopened one at a time after the onboarding (`?completa=<step>`). */
const EDITABLE_STEPS: readonly Step[] = ['source', 'birth', 'photo', ...EXTRA_STEPS];

/** `?completa=<step>` naming a single question to edit, or null. */
function editedStep(data: OnboardingData, param: string | null): Step | null {
  return data.onboarding_completato_at && param && (EDITABLE_STEPS as readonly string[]).includes(param) ? (param as Step) : null;
}

/** Where a user lands: the first required step still missing, or the optional ones on request. */
function firstStep(data: OnboardingData, extras: string | null): Step | 'exit' {
  if (data.onboarding_completato_at) {
    if (extras === null) return 'exit';
    // `?completa=lifestyle` opens that question; a bare `?completa` the first one still unanswered.
    return editedStep(data, extras) ?? missingExtraSteps(data)[0] ?? EXTRA_STEPS[0];
  }
  if (!data.nome || !data.cognome) return 'name';
  if (!data.fonte_scoperta) return 'source';
  if (!data.data_nascita) return 'birth';
  return 'photo';
}

function progressOf(step: Step) {
  const done = step === 'milestone' ? REQUIRED_STEPS.length : PROGRESS_STEPS.indexOf(step);
  return Math.max(MIN_PROGRESS, done / PROGRESS_STEPS.length);
}

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

// ===================== PAGE =====================

export function OnboardingPage() {
  const { t } = useLanguage();
  const preview = isOnboardingPreview();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; data: OnboardingData }>(
    () => (preview ? { status: 'ready', data: PREVIEW_DATA } : { status: 'loading' }),
  );

  const load = useCallback(() => {
    if (preview) return;
    setState({ status: 'loading' });
    claimStoredInvite()
      .then(fetchOnboarding)
      .then((data) => {
        // Keep the shared account in step, so other pages stop (or start) sending the user here.
        patchAccount({ onboarding_completato: data.onboarding_completato_at !== null });
        setState({ status: 'ready', data });
      })
      .catch(() => setState({ status: 'error' }));
  }, [preview]);

  useEffect(load, [load]);

  if (state.status === 'ready') return <OnboardingFlow initial={state.data} preview={preview} />;

  return (
    <OnboardingChrome progress={MIN_PROGRESS} position={undefined}>
      {state.status === 'loading' ? (
        <div className="grid place-items-center py-24" role="status">
          <Loader2 size={28} className="animate-spin text-shutter" aria-hidden />
          <span className="sr-only">{t('loading')}</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-hairline bg-paper p-6 shadow-rest" role="alert">
          <h1 className="text-lg font-black text-pine">{t('onboarding.loadError')}</h1>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" onClick={load} className="h-12 px-5">
              {t('onboarding.retry')}
            </Button>
            <Link href={APP_ROUTES.WAITLIST_CONFIRMED} className="inline-flex h-12 items-center rounded-xl px-4 text-sm font-extrabold text-pine hover:bg-mint-mist">
              {t('onboarding.goToWaitlist')}
            </Link>
          </div>
        </div>
      )}
    </OnboardingChrome>
  );
}

type StepProps = {
  data: OnboardingData;
  eyebrow: string;
  saving: boolean;
  error: string | null;
  save: (patch: OnboardingPatch) => void;
  back?: () => void;
  skip: () => void;
};

function OnboardingFlow({ initial, preview }: { initial: OnboardingData; preview: boolean }) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [data, setData] = useState(initial);
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [step, setStep] = useState<Step | 'exit'>(() => firstStep(initial, params.get(ONBOARDING_EXTRAS_QUERY)));
  // Editing one question (from the profile or the waitlist page): save, then go back there.
  const [singleEdit] = useState(() => editedStep(initial, params.get(ONBOARDING_EXTRAS_QUERY)) !== null);
  // Done (or nothing to do): back to the profile when editing from there, else
  // the user's main page (home for admins and owners, waitlist for students).
  const returnTo = params.get(ONBOARDING_RETURN_QUERY) === ONBOARDING_RETURN_PROFILE
    ? APP_ROUTES.PROFILE
    : mainPageFor(peekRoleCache() ?? peekLastKnownRole());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (step === 'exit') return <Redirect to={returnTo} replace />;

  const current = step;

  function go(next: Step | null) {
    setError(null);
    if (next === null || singleEdit) {
      setLocation(returnTo);
      return;
    }
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  async function save(patch: OnboardingPatch) {
    setSaving(true);
    setError(null);
    try {
      const updated = preview
        ? applyLocally(data, patch)
        : await requestJson<OnboardingData>(API_ROUTE_PATHS.ME_ONBOARDING, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
      // The photo URL is signed per response; keep the one already on screen.
      setData({ ...updated, foto_profilo_url: updated.foto_profilo_url ?? data.foto_profilo_url });
      if (patch.nome && patch.cognome) {
        patchAccount({ nome: patch.nome, cognome: patch.cognome, full_name: `${patch.nome} ${patch.cognome}` });
      }
      if (patch.completato) patchAccount({ onboarding_completato: true });
      go(NEXT_STEP[current]);
    } catch {
      setError(t('onboarding.saveError'));
    } finally {
      setSaving(false);
    }
  }

  const requiredIndex = REQUIRED_STEPS.indexOf(current as RequiredStep);
  const extraIndex = EXTRA_STEPS.indexOf(current as ExtraStep);
  const eyebrow =
    requiredIndex >= 0
      ? fill(t('onboarding.stepOf'), { current: requiredIndex + 1, total: REQUIRED_STEPS.length })
      : fill(t('onboarding.optionalStepOf'), { current: extraIndex + 1, total: EXTRA_STEPS.length });

  const previous = PREVIOUS_STEP[current];
  const props: StepProps = {
    data,
    eyebrow,
    saving,
    error,
    save: (patch) => void save(patch),
    back: singleEdit ? () => go(null) : previous ? () => go(previous) : undefined,
    skip: () => go(NEXT_STEP[current]),
  };

  return (
    <OnboardingChrome progress={progressOf(current)} position={current === 'milestone' ? undefined : data.posizione}>
      {import.meta.env.DEV && preview ? (
        <p className="mb-6 inline-flex rounded-full bg-terracotta-mist px-3 py-1 text-xs font-extrabold text-terracotta">
          Anteprima (solo sviluppo): niente viene salvato
        </p>
      ) : null}
      {current === 'name' && <NameStep key="name" {...props} />}
      {current === 'source' && <SourceStep key="source" {...props} />}
      {current === 'birth' && <BirthStep key="birth" {...props} />}
      {current === 'photo' && (
        <PhotoStep key="photo" {...props} preview={preview} onPhoto={(url) => {
            setData((d) => ({ ...d, foto_profilo_url: url }));
            if (!preview) patchAccount({ foto_profilo_url: url });
          }} />
      )}
      {current === 'milestone' && (
        <Milestone data={data} onContinue={() => go('lifestyle')} onLater={() => go(null)} />
      )}
      {current === 'lifestyle' && <LifestyleStep key="lifestyle" {...props} />}
      {current === 'about' && <AboutStep key="about" {...props} />}
    </OnboardingChrome>
  );
}

// ===================== LAYOUT =====================

/** Top bar: logo, progress, waitlist position. Pass `position={undefined}` to hide the position. */
function OnboardingChrome({ progress, position, children }: { progress: number; position: number | null | undefined; children: ReactNode }) {
  const { t } = useLanguage();
  const percent = Math.round(progress * 100);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-cream text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-4 px-5 sm:gap-8 lg:px-8">
          <span className="flex shrink-0 items-center gap-2">
            <img src={roomlyMark} alt="Roomly" className="h-8 w-8 object-contain" />
            <span className="hidden text-lg font-black tracking-[-0.05em] text-pine sm:inline" aria-hidden>
              roomly
            </span>
          </span>

          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label={t('onboarding.progressAria')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full rounded-full bg-shutter transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>

          {position !== undefined ? (
            <p
              className="inline-flex shrink-0 items-baseline gap-1.5 rounded-full bg-mint-mist px-3.5 py-1.5"
              data-testid="onboarding-position"
            >
              <span className="sr-only">{t('onboarding.positionAria')}: </span>
              <span className="text-base font-black tabular-nums text-pine">{position !== null ? `#${position}` : '—'}</span>
              <span className="text-xs font-extrabold text-sage" aria-hidden>
                {t('onboarding.positionLabel')}
              </span>
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] flex-1 px-5 pb-40 pt-10 sm:pt-16">{children}</main>
    </div>
  );
}

/** One question: eyebrow, big title, Sage line, the answers, and a fixed bottom bar with Back / Skip / Continue. */
function StepFrame({
  eyebrow,
  title,
  text,
  children,
  canContinue,
  onSubmit,
  back,
  skip,
  skipLabel,
  continueLabel,
  saving,
  error,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  children: ReactNode;
  canContinue: boolean;
  onSubmit: () => void;
  back?: () => void;
  skip?: () => void;
  skipLabel?: string;
  continueLabel?: string;
  saving: boolean;
  error: string | null;
}) {
  const { t } = useLanguage();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Each new question moves focus to its title, so screen readers announce it.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canContinue && !saving) onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* The entry animation lives on this inner wrapper, not on the form: its
          transform would otherwise pin the fixed bottom bar to the form instead
          of the bottom of the screen, covering the answers. */}
      <div className="page-enter">
      <p className="text-[11px] font-black uppercase tracking-[0.15em] text-shutter">{eyebrow}</p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-3 max-w-[16ch] text-[clamp(2.25rem,6vw,2.75rem)] font-black leading-[1.05] tracking-[-0.03em] text-pine outline-none"
      >
        {title}
      </h1>
      {text ? <p className="mt-4 max-w-[52ch] text-base leading-7 text-sage">{text}</p> : null}

      <div className="mt-10">{children}</div>

      {error ? (
        <p className="mt-6 text-sm font-semibold text-terracotta" role="alert">
          {error}
        </p>
      ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {/* Phones: Back is just the arrow, so Back + Skip + Continue fit on one line without wrapping. */}
        <div className="mx-auto flex h-20 w-full max-w-[720px] items-center justify-between gap-2 px-4 sm:gap-3 sm:px-5">
          {back ? (
            <Button
              type="button"
              variant="ghost"
              onClick={back}
              disabled={saving}
              className="h-12 w-12 shrink-0 px-0 text-pine sm:w-auto sm:px-3"
              aria-label={t('onboarding.back')}
              data-testid="onboarding-back"
            >
              <ArrowLeft size={18} aria-hidden />
              <span className="hidden sm:inline">{t('onboarding.back')}</span>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            {skip ? (
              <Button type="button" variant="ghost" onClick={skip} disabled={saving} className="h-12 whitespace-nowrap px-3 text-sage hover:text-pine" data-testid="onboarding-skip">
                {skipLabel ?? t('onboarding.skip')}
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={!canContinue || saving}
              className="h-12 min-w-[112px] whitespace-nowrap px-5 text-[15px] sm:min-w-[128px] sm:px-6"
              data-testid="onboarding-continue"
            >
              {saving ? <Loader2 size={17} className="animate-spin" aria-hidden /> : null}
              {saving ? t('onboarding.saving') : continueLabel ?? t('onboarding.continue')}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

// ===================== REQUIRED STEPS =====================

function NameStep({ data, eyebrow, saving, error, save }: StepProps) {
  const { t } = useLanguage();
  const [nome, setNome] = useState(data.nome || data.nome_suggerito);
  const [cognome, setCognome] = useState(data.cognome || data.cognome_suggerito);
  const ready = nome.trim() !== '' && cognome.trim() !== '';

  return (
    <StepFrame
      eyebrow={eyebrow}
      title={t('onboarding.nameTitle')}
      text={t('onboarding.nameText')}
      canContinue={ready}
      onSubmit={() => save({ nome: nome.trim(), cognome: cognome.trim() })}
      saving={saving}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="onboarding-nome">{t('auth.firstNameLabel')}</Label>
          <Input
            id="onboarding-nome"
            autoComplete="given-name"
            maxLength={50}
            placeholder={t('auth.firstNamePlaceholder')}
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            data-testid="input-nome"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="onboarding-cognome">{t('auth.lastNameLabel')}</Label>
          <Input
            id="onboarding-cognome"
            autoComplete="family-name"
            maxLength={50}
            placeholder={t('auth.lastNamePlaceholder')}
            value={cognome}
            onChange={(event) => setCognome(event.target.value)}
            data-testid="input-cognome"
          />
        </div>
      </div>
    </StepFrame>
  );
}

function SourceStep({ data, eyebrow, saving, error, save, back }: StepProps) {
  const { t } = useLanguage();
  // More than one answer allowed: people often hear of us from a friend AND see us on Instagram.
  const [sources, setSources] = useState<Source[]>(() =>
    data.fonti_scoperta.length > 0 ? data.fonti_scoperta : data.fonte_scoperta ? [data.fonte_scoperta] : [],
  );
  const [other, setOther] = useState(data.fonte_scoperta_altro ?? '');
  const hasOther = sources.includes('altro');

  function toggle(option: Source) {
    setSources((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
    );
  }

  return (
    <StepFrame
      eyebrow={eyebrow}
      title={t('onboarding.sourceTitle')}
      text={t('onboarding.sourceText')}
      canContinue={sources.length > 0}
      onSubmit={() =>
        save({
          // Same order as the options on screen, whatever order they were ticked in.
          fonti_scoperta: ONBOARDING_OPTIONS.sources.filter((option) => sources.includes(option)),
          fonte_scoperta_altro: hasOther ? other.trim() || null : null,
        })
      }
      back={back}
      saving={saving}
      error={error}
    >
      <fieldset>
        <legend className="sr-only">{t('onboarding.sourceTitle')}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ONBOARDING_OPTIONS.sources.map((option) => (
            <ChoiceCard
              key={option}
              name="fonti"
              value={option}
              multiple
              checked={sources.includes(option)}
              onSelect={() => toggle(option)}
              icon={SOURCE_ICONS[option]}
              testId={`choice-source-${option}`}
            >
              {t(SOURCE_LABELS[option])}
            </ChoiceCard>
          ))}
        </div>
      </fieldset>

      {hasOther ? (
        <div className="mt-6 flex max-w-md flex-col gap-1.5">
          <Label htmlFor="onboarding-fonte-altro">{t('onboarding.sourceOtherLabel')}</Label>
          <Input
            id="onboarding-fonte-altro"
            maxLength={100}
            autoFocus
            placeholder={t('onboarding.sourceOtherPlaceholder')}
            value={other}
            onChange={(event) => setOther(event.target.value)}
          />
        </div>
      ) : null}
    </StepFrame>
  );
}

function BirthStep({ data, eyebrow, saving, error, save, back }: StepProps) {
  const { t } = useLanguage();
  const [birthDate, setBirthDate] = useState(data.data_nascita ?? '');
  const [ageError, setAgeError] = useState(false);

  return (
    <StepFrame
      eyebrow={eyebrow}
      title={t('onboarding.birthTitle')}
      text={t('onboarding.birthText')}
      canContinue={birthDate !== ''}
      onSubmit={() => {
        if (!isAdult(birthDate)) {
          setAgeError(true);
          return;
        }
        save({ data_nascita: birthDate });
      }}
      back={back}
      saving={saving}
      error={ageError ? t('auth.ageUnder18') : error}
    >
      <div className="flex max-w-sm flex-col gap-1.5">
        <Label htmlFor="onboarding-data-nascita">{t('auth.dateOfBirthLabel')}</Label>
        <BirthDatePicker
          id="onboarding-data-nascita"
          value={birthDate}
          onChange={(value) => {
            setAgeError(false);
            setBirthDate(value);
          }}
          testId="input-data-nascita"
        />
      </div>
    </StepFrame>
  );
}

function PhotoStep({
  data,
  eyebrow,
  saving,
  error,
  save,
  back,
  preview,
  onPhoto,
}: StepProps & { preview: boolean; onPhoto: (url: string) => void }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState(data.foto_profilo_url);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function upload(file: File) {
    setPhotoError(null);
    setUploading(true);
    try {
      const photo = await shrinkPhoto(file);
      const url = preview
        ? URL.createObjectURL(photo)
        : await uploadProfilePhoto(photo);
      setPhotoUrl(url);
      onPhoto(url);
    } catch (uploadError) {
      setPhotoError(t(uploadError instanceof PhotoReadError ? 'onboarding.photoReadError' : 'onboarding.photoUploadError'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const choose = () => inputRef.current?.click();
  // Finishing (or skipping) the photo closes the required part: the backend stamps onboarding_completato_at.
  const finish = () => save({ completato: true });

  return (
    <StepFrame
      eyebrow={eyebrow}
      title={t('onboarding.photoTitle')}
      text={t('onboarding.photoText')}
      canContinue={photoUrl !== null && !uploading}
      onSubmit={finish}
      back={back}
      skip={photoUrl === null && !uploading ? finish : undefined}
      skipLabel={t('onboarding.skipForNow')}
      saving={saving}
      error={photoError ?? error}
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
        <button
          type="button"
          onClick={choose}
          disabled={uploading}
          className={`relative grid h-40 w-40 shrink-0 place-items-center overflow-hidden rounded-full transition-[border-color,background-color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shutter ${
            photoUrl ? 'border border-hairline shadow-lift' : 'border-2 border-dashed border-outline bg-paper hover:border-shutter hover:bg-mint-mist'
          }`}
          aria-label={photoUrl ? t('onboarding.photoChange') : t('onboarding.photoChoose')}
          data-testid="button-photo-circle"
        >
          {photoUrl ? (
            <img src={photoUrl} alt={t('onboarding.photoAlt')} className="h-full w-full object-cover" />
          ) : (
            <Camera size={34} strokeWidth={1.8} className="text-sage" aria-hidden />
          )}
          {uploading ? (
            <span className="absolute inset-0 grid place-items-center bg-scrim" role="status">
              <Loader2 size={28} className="animate-spin text-mint-mist" aria-hidden />
              <span className="sr-only">{t('onboarding.photoUploading')}</span>
            </span>
          ) : null}
        </button>

        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Button type="button" variant="outline" onClick={choose} disabled={uploading} className="h-12 px-5 text-[15px]">
            <ImagePlus size={18} aria-hidden />
            {photoUrl ? t('onboarding.photoChange') : t('onboarding.photoChoose')}
          </Button>
          <p className="text-xs font-bold text-sage">{t('onboarding.photoFormats')}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={PROFILE_PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
        data-testid="input-photo"
      />
    </StepFrame>
  );
}

function Milestone({ data, onContinue, onLater }: { data: OnboardingData; onContinue: () => void; onLater: () => void }) {
  const { t } = useLanguage();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="page-enter">
      <section className="relative grid gap-8 overflow-hidden rounded-[2rem] bg-mint-wash px-6 py-10 sm:grid-cols-[1fr_auto] sm:items-center sm:px-10">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-pine">{t('onboarding.milestoneEyebrow')}</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-3 text-[clamp(2.5rem,7vw,3.5rem)] font-black leading-[1.02] tracking-[-0.03em] text-pine outline-none"
          >
            {fill(t('onboarding.milestoneTitle'), { name: data.nome })}
          </h1>
          <p className="mt-4 max-w-sm text-base leading-7 text-pine-text">{t('onboarding.milestoneText')}</p>
        </div>
        <div className="inline-flex flex-col justify-self-start rounded-2xl border border-hairline bg-paper px-8 py-5 shadow-float sm:justify-self-end">
          <span className="text-sm font-bold text-sage">{t('onboarding.milestonePositionLabel')}</span>
          <span className="mt-1 text-[56px] font-black leading-none tracking-[-0.05em] tabular-nums text-pine" data-testid="milestone-position">
            {data.posizione !== null ? `#${data.posizione}` : '—'}
          </span>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-hairline bg-paper p-6 shadow-rest sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-sage">{t('onboarding.completeMeta')}</p>
        <h2 className="mt-2 text-[clamp(1.375rem,3vw,1.75rem)] font-black tracking-[-0.02em] text-pine">{t('onboarding.completeTitle')}</h2>
        <p className="mt-2 max-w-[56ch] text-[15px] leading-6 text-sage">{t('onboarding.completeText')}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="amber" onClick={onContinue} className="h-12 px-6 text-[15px]" data-testid="button-complete-profile">
            {t('onboarding.completeCta')}
            <ArrowRight size={17} aria-hidden />
          </Button>
          <Button type="button" variant="ghost" onClick={onLater} className="h-12 px-4 text-pine" data-testid="button-later">
            {t('onboarding.later')}
          </Button>
        </div>
      </section>
    </div>
  );
}

// ===================== OPTIONAL STEPS =====================

function LifestyleStep({ data, eyebrow, saving, error, save, back, skip }: StepProps) {
  const { t } = useLanguage();
  const saved = data.preferenze;
  const [pets, setPets] = useState<YesNoAny | null>(fromBoolean(saved?.animali));
  const [smoking, setSmoking] = useState<YesNoAny | null>(fromBoolean(saved?.fumatori));
  const [noise, setNoise] = useState(saved?.livello_rumore_preferito ?? null);
  const [cleanliness, setCleanliness] = useState(saved?.ordine_pulizia ?? null);
  const [schedule, setSchedule] = useState(saved?.orari_sosta ?? null);
  const [study, setStudy] = useState(saved?.abitudini_studio ?? null);

  const answered = [pets, smoking, noise, cleanliness, schedule, study].some((value) => value !== null);

  function submit() {
    const preferenze: Partial<UserPreferences> = {};
    if (pets) preferenze.animali = toBoolean(pets);
    if (smoking) preferenze.fumatori = toBoolean(smoking);
    if (noise) preferenze.livello_rumore_preferito = noise;
    if (cleanliness) preferenze.ordine_pulizia = cleanliness;
    if (schedule) preferenze.orari_sosta = schedule;
    if (study) preferenze.abitudini_studio = study;
    save({ preferenze });
  }

  const yesNo = (name: string, value: YesNoAny | null, set: (next: YesNoAny) => void) =>
    (['yes', 'no', 'any'] as const).map((option) => (
      <ChoiceChip key={option} name={name} value={option} checked={value === option} onSelect={() => set(option)}>
        {t(option === 'yes' ? 'preferences.yes' : option === 'no' ? 'preferences.no' : 'preferences.noPreference')}
      </ChoiceChip>
    ));

  return (
    <StepFrame
      eyebrow={eyebrow}
      title={t('onboarding.lifestyleTitle')}
      text={t('onboarding.lifestyleText')}
      canContinue={answered}
      onSubmit={submit}
      back={back}
      skip={skip}
      saving={saving}
      error={error}
    >
      <div className="grid gap-8 sm:grid-cols-2">
        <ChipGroup legend={t('onboarding.lifestylePets')}>{yesNo('animali', pets, setPets)}</ChipGroup>
        <ChipGroup legend={t('onboarding.lifestyleSmoking')}>{yesNo('fumatori', smoking, setSmoking)}</ChipGroup>
        <ChipGroup legend={t('preferences.noise')}>
          {USER_PREFERENCE_OPTIONS.noise.map((option) => (
            <ChoiceChip key={option} name="rumore" value={option} checked={noise === option} onSelect={() => setNoise(option)}>
              {t(NOISE_LABELS[option])}
            </ChoiceChip>
          ))}
        </ChipGroup>
        <ChipGroup legend={t('preferences.cleanliness')}>
          {USER_PREFERENCE_OPTIONS.cleanliness.map((option) => (
            <ChoiceChip key={option} name="pulizia" value={option} checked={cleanliness === option} onSelect={() => setCleanliness(option)}>
              {t(CLEANLINESS_LABELS[option])}
            </ChoiceChip>
          ))}
        </ChipGroup>
        <ChipGroup legend={t('preferences.schedule')}>
          {USER_PREFERENCE_OPTIONS.schedule.map((option) => (
            <ChoiceChip key={option} name="orari" value={option} checked={schedule === option} onSelect={() => setSchedule(option)}>
              {t(SCHEDULE_LABELS[option])}
            </ChoiceChip>
          ))}
        </ChipGroup>
        <ChipGroup legend={t('preferences.study')}>
          {USER_PREFERENCE_OPTIONS.studyHabits.map((option) => (
            <ChoiceChip key={option} name="studio" value={option} checked={study === option} onSelect={() => setStudy(option)}>
              {t(STUDY_LABELS[option])}
            </ChoiceChip>
          ))}
        </ChipGroup>
      </div>
    </StepFrame>
  );
}

function AboutStep({ data, eyebrow, saving, error, save, back, skip }: StepProps) {
  const { t } = useLanguage();
  const [bio, setBio] = useState(data.bio ?? '');

  return (
    <StepFrame
      eyebrow={eyebrow}
      title={t('onboarding.aboutTitle')}
      text={t('onboarding.aboutText')}
      canContinue={bio.trim() !== ''}
      onSubmit={() => save({ bio: bio.trim() })}
      back={back}
      skip={skip}
      continueLabel={t('onboarding.finish')}
      saving={saving}
      error={error}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="onboarding-bio">{t('onboarding.aboutLabel')}</Label>
        <textarea
          id="onboarding-bio"
          rows={5}
          maxLength={PROFILE_BIO_MAX_LENGTH_CHARS}
          placeholder={t('onboarding.aboutPlaceholder')}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className="w-full resize-none rounded-xl border border-field bg-paper px-3.5 py-3 text-base leading-7 text-ink transition-[border-color,box-shadow] placeholder:text-sage-placeholder focus-visible:border-shutter focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mint-wash/40"
          aria-describedby="onboarding-bio-count"
          data-testid="input-bio"
        />
        <p id="onboarding-bio-count" className="self-end text-xs font-bold tabular-nums text-sage">
          {bio.length}/{PROFILE_BIO_MAX_LENGTH_CHARS}
        </p>
      </div>
    </StepFrame>
  );
}
