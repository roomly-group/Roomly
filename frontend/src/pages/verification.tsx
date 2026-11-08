import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  BadgeCheck,
  Camera,
  CircleAlert,
  Clock,
  FileImage,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Square,
  Upload,
  Video,
} from 'lucide-react';
import {
  VERIFICATION_DOCUMENT_TYPES,
  VERIFICATION_VIDEO_MAX_SECONDS,
  type MyVerification,
  type MyVerificationAttemptItem,
  type VerificationDocumentSide,
  type VerificationDocumentType,
} from '@workspace/api-zod';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES } from '@/lib/constants';
import { peekLastKnownRole, peekRoleCache } from '@/lib/role-cache';
import { cn } from '@/lib/utils';
import {
  DOCUMENT_PHOTO_ACCEPT,
  DocumentReadError,
  VideoTooLargeError,
  myVerificationQueryKey,
  shrinkDocumentPhoto,
  useMyVerification,
  verificationApi,
  type VerificationApi,
} from '@/hooks/use-verification';
import { AppShell } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { QueryError } from '@/components/shared/query-error';
import { Button } from '@/components/shared/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';

// Identity verification for the user (/verifica): document type and consent,
// front and back photos, a short challenge video, then "send for review".
// A Roomly reviewer decides at /admin/verifiche. Every step is saved on the
// server as soon as it is done, so leaving half-way never loses anything.
// Backend: routes/verification.ts.

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** `/verifica?preview` in development: the whole flow with sample data, nothing saved, no login needed. */
const VERIFICATION_PREVIEW_QUERY = 'preview' as const;
/** Bits per second of the recorded video: about 4 MB for 30 seconds, plenty for a face and a document. */
const RECORDER_VIDEO_BITS_PER_SECOND = 1_000_000 as const;
/** Recording formats tried in order; the first one the browser supports is used. */
const RECORDER_MIME_TYPES = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'] as const;
/** Fake upload delay in preview mode (ms), so the loading states can be seen. */
const PREVIEW_DELAY_MS = 600 as const;

/** Stable selectors for the verification flow. */
const VERIFICATION_TEST_IDS = {
  SELECT_DOCUMENT_TYPE: 'select-document-type',
  CHECK_CONSENT: 'check-verification-consent',
  CHECK_TRAINING: 'check-training-consent',
  BUTTON_START: 'button-start-verification',
  INPUT_DOCUMENT_PREFIX: 'input-document-',
  BUTTON_CONTINUE: 'button-verification-continue',
  BUTTON_CAMERA: 'button-open-camera',
  BUTTON_RECORD: 'button-record-video',
  BUTTON_USE_VIDEO: 'button-use-video',
  INPUT_VIDEO: 'input-upload-video',
  BUTTON_SUBMIT: 'button-submit-verification',
  BUTTON_RETRY: 'button-retry-verification',
  SWITCH_TRAINING: 'switch-training-consent',
} as const;

type FlowStep = 'front' | 'back' | 'video' | 'review';

const FLOW_STEPS: { key: 'intro' | FlowStep; label: TranslationKey }[] = [
  { key: 'intro', label: 'verification.stepIntro' },
  { key: 'front', label: 'verification.stepFront' },
  { key: 'back', label: 'verification.stepBack' },
  { key: 'video', label: 'verification.stepVideo' },
  { key: 'review', label: 'verification.stepReview' },
];

/** Dev-only preview of the flow (the router skips the login check for it). Always false in production builds. */
export function isVerificationPreview(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has(VERIFICATION_PREVIEW_QUERY);
}

/** First step still missing in a draft. */
function firstMissingStep(attempt: MyVerificationAttemptItem): FlowStep {
  if (!attempt.hasFront) return 'front';
  if (!attempt.hasBack) return 'back';
  if (!attempt.hasVideo) return 'video';
  return 'review';
}

// ===================== PREVIEW =====================

const PREVIEW_START: MyVerification = {
  verified: false,
  verifiedAt: null,
  attempt: null,
  details: { firstName: 'Giulia', lastName: 'Esposito', birthDate: '1999-04-12' },
  identityLocked: false,
};

/** Where the user edits name and date of birth: owners and students have different profile pages. */
function profileHref(): string {
  return (peekRoleCache() ?? peekLastKnownRole())?.owner ? APP_ROUTES.OWNER_PROFILE : APP_ROUTES.PROFILE;
}

/** Same shape as verificationApi, but everything happens in memory. */
function previewApi(get: () => MyVerification): VerificationApi {
  const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), PREVIEW_DELAY_MS));
  const patch = (changes: Partial<MyVerificationAttemptItem>) => {
    const current = get();
    return { ...current, attempt: current.attempt ? { ...current.attempt, ...changes } : null };
  };
  return {
    start: (input) =>
      wait({
        ...get(),
        verified: false,
        verifiedAt: null,
        attempt: {
          id: 1,
          status: 'bozza',
          documentType: input.documentType,
          challengeCode: '4729',
          challengeGestures: ['turn_left', 'document_next_to_face'],
          consentTraining: input.consentTraining,
          hasFront: false,
          hasBack: false,
          hasVideo: false,
          submittedAt: null,
          rejectionReason: null,
          reviewerNote: null,
        },
      }),
    uploadDocument: (side) => wait(patch(side === 'front' ? { hasFront: true } : { hasBack: true })),
    uploadVideo: () => wait(patch({ hasVideo: true })),
    submit: () => wait({ ...patch({ status: 'in_attesa', submittedAt: new Date().toISOString() }), identityLocked: true }),
    setTrainingConsent: (consent) => wait(patch({ consentTraining: consent })),
  };
}

// ===================== PAGE =====================

export function VerificationPage() {
  const { t } = useLanguage();
  const preview = isVerificationPreview();
  const query = useMyVerification(!preview);
  const client = useQueryClient();
  const [previewData, setPreviewData] = useState<MyVerification>(PREVIEW_START);
  const previewRef = useRef(previewData);
  previewRef.current = previewData;

  const data = preview ? previewData : query.data;
  const api = preview ? previewApi(() => previewRef.current) : verificationApi;
  const save = (next: MyVerification) => {
    if (preview) setPreviewData(next);
    else client.setQueryData(myVerificationQueryKey, next);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[760px] px-5 py-8 lg:px-8 lg:py-12">
        {preview ? (
          <p className="mb-6 rounded-xl bg-sun/30 px-4 py-2.5 text-sm font-bold text-ink" role="note">
            {t('verification.previewBanner')}
          </p>
        ) : null}
        <PageIntro eyebrow={t('verification.profileTitle')} title={t('verification.title')} description={t('verification.subtitle')} />

        {!preview && query.isLoading ? (
          <div className="space-y-4" aria-busy>
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : !preview && query.isError ? (
          <QueryError onRetry={() => void query.refetch()} />
        ) : data ? (
          <VerificationContent data={data} api={api} onSaved={save} />
        ) : null}
      </div>
    </AppShell>
  );
}

function VerificationContent({
  data,
  api,
  onSaved,
}: {
  data: MyVerification;
  api: VerificationApi;
  onSaved: (next: MyVerification) => void;
}) {
  const attempt = data.attempt;
  if (data.verified) return <VerifiedView data={data} api={api} onSaved={onSaved} />;
  if (attempt?.status === 'in_attesa') return <PendingView attempt={attempt} api={api} onSaved={onSaved} />;
  if (attempt?.status === 'bozza') return <Flow key={attempt.id} attempt={attempt} api={api} onSaved={onSaved} />;
  return (
    <IntroStep
      rejected={attempt?.status === 'rifiutata' ? attempt : null}
      details={data.details}
      api={api}
      onSaved={onSaved}
    />
  );
}

// ===================== STEPPER =====================

function Stepper({ current }: { current: 'intro' | FlowStep }) {
  const { t } = useLanguage();
  const index = FLOW_STEPS.findIndex((step) => step.key === current);
  return (
    <ol className="mb-6 grid grid-cols-5 gap-2" aria-label={t('verification.title')}>
      {FLOW_STEPS.map((step, position) => (
        <li key={step.key} className="min-w-0" aria-current={position === index ? 'step' : undefined}>
          <span
            className={cn(
              'block h-1.5 rounded-full',
              position < index ? 'bg-shutter' : position === index ? 'bg-pine' : 'bg-line',
            )}
          />
          <span
            className={cn(
              'mt-1.5 block truncate text-xs font-extrabold',
              position === index ? 'text-pine' : 'text-sage',
            )}
          >
            {t(step.label)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('surface rounded-2xl p-5 sm:p-7', className)}>{children}</section>;
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-2 text-sm font-semibold text-red-700" role="alert">
      <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

// ===================== INTRO =====================

function IntroStep({
  rejected,
  details,
  api,
  onSaved,
}: {
  rejected: MyVerificationAttemptItem | null;
  details: MyVerification['details'];
  api: VerificationApi;
  onSaved: (next: MyVerification) => void;
}) {
  const { t, language } = useLanguage();
  const [documentType, setDocumentType] = useState<VerificationDocumentType>(rejected?.documentType ?? 'carta_identita');
  const [confirmed, setConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [training, setTraining] = useState(rejected?.consentTraining ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailsComplete = Boolean(details.firstName && details.lastName && details.birthDate);
  const canStart = detailsComplete && confirmed && consent;
  const birthText = details.birthDate
    ? new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(new Date(`${details.birthDate}T00:00:00`))
    : null;

  async function start() {
    if (!canStart) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.start({ documentType, consentVerification: true, confirmDetails: true, consentTraining: training }));
    } catch {
      setError(t('verification.error'));
      setBusy(false);
    }
  }

  return (
    <>
      {rejected ? (
        <div className="mb-6 rounded-2xl border border-terracotta/30 bg-terracotta-mist p-5" role="status">
          <p className="flex items-center gap-2 font-black text-pine">
            <CircleAlert size={18} className="text-terracotta" aria-hidden />
            {t('verification.rejectedTitle')}
          </p>
          {rejected.rejectionReason ? (
            <p className="mt-2 text-sm text-ink">
              <span className="font-extrabold">{t('verification.rejectedReason')}:</span>{' '}
              {t(`verification.reason.${rejected.rejectionReason}` as TranslationKey)}
            </p>
          ) : null}
          {rejected.reviewerNote ? <p className="mt-1 text-sm text-sage">{rejected.reviewerNote}</p> : null}
        </div>
      ) : null}

      <Stepper current="intro" />
      <Card>
        <h2 className="text-xl font-black text-pine">{t('verification.howTitle')}</h2>
        <ol className="mt-4 space-y-3">
          {(['verification.how1', 'verification.how2', 'verification.how3'] as const).map((key, position) => (
            <li key={key} className="flex gap-3 text-[15px] leading-6 text-ink">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint-mist text-sm font-black text-pine">
                {position + 1}
              </span>
              {t(key)}
            </li>
          ))}
        </ol>

        <div className="mt-7 rounded-2xl border border-hairline bg-cream p-4 sm:p-5" data-testid="panel-verification-details">
          <h3 className="text-base font-black text-pine">{t('verification.detailsTitle')}</h3>
          <p className="mt-1 text-sm leading-6 text-sage">{t('verification.detailsText')}</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {(
              [
                ['verification.firstName', details.firstName],
                ['verification.lastName', details.lastName],
                ['verification.birthDate', birthText],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-sage">{t(label)}</dt>
                <dd className={cn('mt-0.5 truncate text-[15px] font-black', value ? 'text-ink' : 'text-terracotta')}>
                  {value ?? t('verification.missing')}
                </dd>
              </div>
            ))}
          </dl>

          {detailsComplete ? (
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-bold leading-6 text-ink">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-shutter"
                data-testid="check-confirm-details"
              />
              {t('verification.confirmDetails')}
            </label>
          ) : (
            <p className="mt-4 text-sm font-bold text-terracotta" role="alert">
              {t('verification.detailsMissing')}
            </p>
          )}
          <Link href={profileHref()} className="mt-3 inline-flex text-sm font-extrabold text-shutter hover:underline">
            {t('verification.editDetails')} →
          </Link>
        </div>

        <fieldset className="mt-7">
          <legend className="mb-2 text-sm font-extrabold text-pine">{t('verification.docTypeLabel')}</legend>
          <div className="grid gap-2 sm:grid-cols-2" data-testid={VERIFICATION_TEST_IDS.SELECT_DOCUMENT_TYPE}>
            {VERIFICATION_DOCUMENT_TYPES.map((type) => (
              <label
                key={type}
                className={cn(
                  'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-shutter',
                  documentType === type ? 'border-shutter bg-mint-mist text-pine' : 'border-hairline bg-paper text-ink hover:border-outline',
                )}
              >
                <input
                  type="radio"
                  name="document-type"
                  value={type}
                  checked={documentType === type}
                  onChange={() => setDocumentType(type)}
                  className="sr-only"
                />
                <FileImage size={18} className="shrink-0 text-shutter" aria-hidden />
                {t(`verification.docType.${type}` as TranslationKey)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-7 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-ink">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-shutter"
              data-testid={VERIFICATION_TEST_IDS.CHECK_CONSENT}
            />
            {t('verification.consentVerification')}
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-sage">
            <input
              type="checkbox"
              checked={training}
              onChange={(event) => setTraining(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-shutter"
              data-testid={VERIFICATION_TEST_IDS.CHECK_TRAINING}
            />
            {t('verification.consentTraining')}
          </label>
        </div>

        <div className="mt-7 space-y-3">
          <ErrorLine message={error} />
          <Button
            onClick={() => void start()}
            disabled={!canStart || busy}
            className="w-full py-3 sm:w-auto sm:px-8"
            data-testid={VERIFICATION_TEST_IDS.BUTTON_START}
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
            {busy ? t('verification.starting') : rejected ? t('verification.tryAgain') : t('verification.start')}
          </Button>
        </div>
      </Card>
    </>
  );
}

// ===================== FLOW =====================

function Flow({
  attempt,
  api,
  onSaved,
}: {
  attempt: MyVerificationAttemptItem;
  api: VerificationApi;
  onSaved: (next: MyVerification) => void;
}) {
  const [step, setStep] = useState<FlowStep>(() => firstMissingStep(attempt));
  // Local copies of what was uploaded in this visit, so the review step can show them.
  const [previews, setPreviews] = useState<{ front?: string; back?: string; video?: string }>({});

  useEffect(
    () => () => {
      Object.values(previews).forEach((url) => url && URL.revokeObjectURL(url));
    },
    // Revoke only when leaving the flow: the URLs are still shown while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const remember = (key: 'front' | 'back' | 'video', url: string) =>
    setPreviews((current) => {
      if (current[key]) URL.revokeObjectURL(current[key]!);
      return { ...current, [key]: url };
    });

  return (
    <>
      <Stepper current={step} />
      {step === 'front' || step === 'back' ? (
        <DocumentStep
          key={step}
          side={step}
          done={step === 'front' ? attempt.hasFront : attempt.hasBack}
          previewUrl={previews[step]}
          api={api}
          onSaved={onSaved}
          onPreview={(url) => remember(step, url)}
          onBack={step === 'back' ? () => setStep('front') : undefined}
          onContinue={() => setStep(step === 'front' ? 'back' : 'video')}
        />
      ) : step === 'video' ? (
        <VideoStep
          attempt={attempt}
          previewUrl={previews.video}
          api={api}
          onSaved={onSaved}
          onPreview={(url) => remember('video', url)}
          onBack={() => setStep('back')}
          onContinue={() => setStep('review')}
        />
      ) : (
        <ReviewStep attempt={attempt} previews={previews} api={api} onSaved={onSaved} onEdit={setStep} />
      )}
    </>
  );
}

function StepActions({
  onBack,
  onContinue,
  canContinue,
}: {
  onBack?: () => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="mt-7 flex flex-wrap items-center gap-3">
      {onBack ? (
        <Button variant="outline" onClick={onBack}>
          {t('verification.back')}
        </Button>
      ) : null}
      <Button onClick={onContinue} disabled={!canContinue} className="px-6" data-testid={VERIFICATION_TEST_IDS.BUTTON_CONTINUE}>
        {t('verification.continue')}
      </Button>
    </div>
  );
}

// ===================== DOCUMENT PHOTOS =====================

function DocumentStep({
  side,
  done,
  previewUrl,
  api,
  onSaved,
  onPreview,
  onBack,
  onContinue,
}: {
  side: VerificationDocumentSide;
  done: boolean;
  previewUrl?: string;
  api: VerificationApi;
  onSaved: (next: MyVerification) => void;
  onPreview: (url: string) => void;
  onBack?: () => void;
  onContinue: () => void;
}) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await shrinkDocumentPhoto(file);
      onSaved(await api.uploadDocument(side, photo));
      onPreview(URL.createObjectURL(photo));
    } catch (err) {
      setError(err instanceof DocumentReadError ? t('verification.photoReadError') : t('verification.error'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const inputId = `verification-document-${side}`;
  return (
    <Card>
      <h2 className="text-xl font-black text-pine">{side === 'front' ? t('verification.frontTitle') : t('verification.backTitle')}</h2>
      <p className="mt-2 text-[15px] leading-6 text-sage">{t('verification.photoText')}</p>

      <div className="mt-5 overflow-hidden rounded-2xl border-2 border-dashed border-outline bg-cream">
        {previewUrl ? (
          <img src={previewUrl} alt={side === 'front' ? t('verification.frontTitle') : t('verification.backTitle')} className="mx-auto max-h-80 w-full object-contain" />
        ) : (
          <div className="grid aspect-[1.586] place-items-center p-6 text-center">
            {done ? (
              <p className="flex items-center gap-2 font-extrabold text-shutter">
                <BadgeCheck size={20} aria-hidden />
                {t('verification.photoUploaded')}
              </p>
            ) : (
              <FileImage size={48} className="text-outline" aria-hidden />
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={DOCUMENT_PHOTO_ACCEPT}
          className="sr-only"
          onChange={(event) => void choose(event.target.files?.[0])}
          disabled={busy}
          data-testid={`${VERIFICATION_TEST_IDS.INPUT_DOCUMENT_PREFIX}${side}`}
        />
        <label
          htmlFor={inputId}
          className={cn(
            'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-colors',
            done || previewUrl ? 'border border-outline text-pine hover:bg-mint-mist' : 'bg-shutter text-mint-mist hover:bg-pine',
            busy && 'pointer-events-none opacity-60',
          )}
        >
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Camera size={16} aria-hidden />}
          {busy ? t('verification.uploading') : done || previewUrl ? t('verification.retakePhoto') : t('verification.takePhoto')}
        </label>
      </div>

      <div className="mt-3">
        <ErrorLine message={error} />
      </div>
      <StepActions onBack={onBack} onContinue={onContinue} canContinue={done && !busy} />
    </Card>
  );
}

// ===================== VIDEO =====================

type RecorderState = 'off' | 'starting' | 'ready' | 'recording' | 'recorded' | 'blocked';

function ChallengeBox({ attempt }: { attempt: MyVerificationAttemptItem }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl bg-pine p-5 text-mint-mist">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-mint-wash">{t('verification.sayCode')}</p>
      <p className="mt-1 text-3xl font-black tracking-[0.08em] tabular-nums">Roomly {attempt.challengeCode}</p>
      <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.12em] text-mint-wash">{t('verification.thenDo')}</p>
      <ol className="mt-1 space-y-1 text-[15px] font-bold">
        {attempt.challengeGestures.map((gesture, position) => (
          <li key={gesture}>
            {position + 1}. {t(`verification.gesture.${gesture}` as TranslationKey)}
          </li>
        ))}
      </ol>
    </div>
  );
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return RECORDER_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function VideoStep({
  attempt,
  previewUrl,
  api,
  onSaved,
  onPreview,
  onBack,
  onContinue,
}: {
  attempt: MyVerificationAttemptItem;
  previewUrl?: string;
  api: VerificationApi;
  onSaved: (next: MyVerification) => void;
  onPreview: (url: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { t } = useLanguage();
  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canRecord = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(pickRecorderMime());

  const [state, setState] = useState<RecorderState>(canRecord ? 'off' : 'blocked');
  const [seconds, setSeconds] = useState(0);
  const [recorded, setRecorded] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };
  const clearTimer = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(
    () => () => {
      clearTimer();
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      stopCamera();
    },
    [],
  );

  async function openCamera() {
    setError(null);
    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      setState('ready');
    } catch {
      setState('blocked');
    }
  }

  // Attach the stream once the <video> for it is on screen.
  useEffect(() => {
    if ((state === 'ready' || state === 'recording') && liveRef.current && streamRef.current) {
      liveRef.current.srcObject = streamRef.current;
      void liveRef.current.play().catch(() => undefined);
    }
  }, [state]);

  function startRecording() {
    const stream = streamRef.current;
    const mimeType = pickRecorderMime();
    if (!stream || !mimeType) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: RECORDER_VIDEO_BITS_PER_SECOND });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      clearTimer();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType });
      setRecorded((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { blob, url: URL.createObjectURL(blob) };
      });
      stopCamera();
      setState('recorded');
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setSeconds(0);
    setState('recording');
    timerRef.current = window.setInterval(() => {
      setSeconds((value) => {
        const next = value + 1;
        if (next >= VERIFICATION_VIDEO_MAX_SECONDS && recorder.state === 'recording') recorder.stop();
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  async function upload(video: Blob) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.uploadVideo(video));
      onPreview(URL.createObjectURL(video));
      onContinue();
    } catch (err) {
      setError(err instanceof VideoTooLargeError ? t('verification.videoTooLarge') : t('verification.error'));
    } finally {
      setBusy(false);
    }
  }

  const live = state === 'ready' || state === 'recording';
  return (
    <Card>
      <h2 className="text-xl font-black text-pine">{t('verification.videoTitle')}</h2>
      <p className="mt-2 text-[15px] leading-6 text-sage">{t('verification.videoText')}</p>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="relative overflow-hidden rounded-2xl bg-ink">
          {live ? (
            // Mirrored like a mirror; the recording itself is not.
            <video ref={liveRef} muted playsInline className="aspect-[4/3] w-full -scale-x-100 object-cover" />
          ) : recorded ? (
            <video src={recorded.url} controls playsInline className="aspect-[4/3] w-full bg-ink object-contain" />
          ) : previewUrl ? (
            <video src={previewUrl} controls playsInline className="aspect-[4/3] w-full bg-ink object-contain" />
          ) : (
            <div className="grid aspect-[4/3] place-items-center p-6 text-center text-mint-wash">
              {attempt.hasVideo ? (
                <p className="flex items-center gap-2 font-extrabold">
                  <BadgeCheck size={20} aria-hidden />
                  {t('verification.videoUploaded')}
                </p>
              ) : (
                <Video size={48} aria-hidden />
              )}
            </div>
          )}
          {state === 'recording' ? (
            <p className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-ink/80 px-3 py-1 text-sm font-extrabold text-white" role="status">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
              {t('verification.recording')} · {seconds}s / {VERIFICATION_VIDEO_MAX_SECONDS}s
            </p>
          ) : null}
        </div>
        <ChallengeBox attempt={attempt} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {state === 'off' || state === 'starting' ? (
          <Button onClick={() => void openCamera()} disabled={state === 'starting'} data-testid={VERIFICATION_TEST_IDS.BUTTON_CAMERA}>
            {state === 'starting' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Camera size={16} aria-hidden />}
            {state === 'starting' ? t('verification.cameraStarting') : t('verification.cameraOpen')}
          </Button>
        ) : null}
        {state === 'ready' ? (
          <Button onClick={startRecording} data-testid={VERIFICATION_TEST_IDS.BUTTON_RECORD}>
            <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden />
            {t('verification.recordStart')}
          </Button>
        ) : null}
        {state === 'recording' ? (
          <Button variant="outline" onClick={stopRecording} data-testid={VERIFICATION_TEST_IDS.BUTTON_RECORD}>
            <Square size={14} aria-hidden />
            {t('verification.recordStop')}
          </Button>
        ) : null}
        {state === 'recorded' && recorded ? (
          <>
            <Button onClick={() => void upload(recorded.blob)} disabled={busy} data-testid={VERIFICATION_TEST_IDS.BUTTON_USE_VIDEO}>
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Upload size={16} aria-hidden />}
              {busy ? t('verification.uploading') : t('verification.useVideo')}
            </Button>
            <Button variant="outline" onClick={() => void openCamera()} disabled={busy}>
              <RotateCcw size={16} aria-hidden />
              {t('verification.recordAgain')}
            </Button>
          </>
        ) : null}
      </div>

      {state === 'blocked' ? (
        <div className="mt-5 rounded-xl bg-sun/25 p-4">
          <p className="text-sm leading-6 text-ink">{t('verification.cameraBlocked')}</p>
          <input
            ref={fileRef}
            id="verification-video-file"
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }}
            disabled={busy}
            data-testid={VERIFICATION_TEST_IDS.INPUT_VIDEO}
          />
          <label
            htmlFor="verification-video-file"
            className={cn(
              'mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-shutter px-4 py-2.5 text-sm font-extrabold text-mint-mist hover:bg-pine',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Upload size={16} aria-hidden />}
            {busy ? t('verification.uploading') : t('verification.uploadVideo')}
          </label>
        </div>
      ) : null}

      <div className="mt-3">
        <ErrorLine message={error} />
      </div>
      <StepActions onBack={onBack} onContinue={onContinue} canContinue={attempt.hasVideo && !busy && state !== 'recording'} />
    </Card>
  );
}

// ===================== REVIEW =====================

function ReviewStep({
  attempt,
  previews,
  api,
  onSaved,
  onEdit,
}: {
  attempt: MyVerificationAttemptItem;
  previews: { front?: string; back?: string; video?: string };
  api: VerificationApi;
  onSaved: (next: MyVerification) => void;
  onEdit: (step: FlowStep) => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.submit());
    } catch {
      setError(t('verification.error'));
      setBusy(false);
    }
  }

  const items: { step: FlowStep; label: TranslationKey; done: boolean; preview?: string; video?: boolean }[] = [
    { step: 'front', label: 'verification.reviewFront', done: attempt.hasFront, preview: previews.front },
    { step: 'back', label: 'verification.reviewBack', done: attempt.hasBack, preview: previews.back },
    { step: 'video', label: 'verification.reviewVideo', done: attempt.hasVideo, preview: previews.video, video: true },
  ];

  return (
    <Card>
      <h2 className="text-xl font-black text-pine">{t('verification.reviewTitle')}</h2>
      <p className="mt-2 text-[15px] leading-6 text-sage">{t('verification.reviewText')}</p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.step} className="overflow-hidden rounded-2xl border border-hairline bg-paper">
            <div className="grid aspect-[4/3] place-items-center bg-cream">
              {item.preview ? (
                item.video ? (
                  <video src={item.preview} muted playsInline className="h-full w-full object-cover" />
                ) : (
                  <img src={item.preview} alt="" className="h-full w-full object-contain" />
                )
              ) : (
                <BadgeCheck size={32} className={item.done ? 'text-shutter' : 'text-outline'} aria-hidden />
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="text-sm font-extrabold text-pine">{t(item.label)}</span>
              <button
                type="button"
                onClick={() => onEdit(item.step)}
                className="rounded-lg px-2 py-1 text-xs font-extrabold text-shutter hover:bg-mint-mist"
              >
                <RotateCcw size={14} aria-hidden />
                <span className="sr-only">{t(item.label)}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-3">
        <ErrorLine message={error} />
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => onEdit('video')} disabled={busy}>
            {t('verification.back')}
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy || !attempt.hasFront || !attempt.hasBack || !attempt.hasVideo}
            className="px-6"
            data-testid={VERIFICATION_TEST_IDS.BUTTON_SUBMIT}
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
            {busy ? t('verification.submitting') : t('verification.submit')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ===================== RESULT =====================

function TrainingToggle({
  checked,
  api,
  onSaved,
}: {
  checked: boolean;
  api: VerificationApi;
  onSaved: (next: MyVerification) => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      onSaved(await api.setTrainingConsent(next));
      setMessage(t('verification.trainingSaved'));
    } catch {
      setMessage(t('verification.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <label className="flex cursor-pointer items-start justify-between gap-4 text-sm leading-6 text-ink">
        <span>{t('verification.trainingToggle')}</span>
        <Switch
          checked={checked}
          onCheckedChange={(next) => void change(next)}
          disabled={busy}
          className="mt-1 data-[state=checked]:bg-shutter"
          data-testid={VERIFICATION_TEST_IDS.SWITCH_TRAINING}
        />
      </label>
      {message ? (
        <p className="mt-2 text-xs font-bold text-sage" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function PendingView({
  attempt,
  api,
  onSaved,
}: {
  attempt: MyVerificationAttemptItem;
  api: VerificationApi;
  onSaved: (next: MyVerification) => void;
}) {
  const { t } = useLanguage();
  return (
    <Card>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-sun/40 text-ink">
        <Clock size={22} aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-black text-pine">{t('verification.pendingTitle')}</h2>
      <p className="mt-2 text-[15px] leading-6 text-sage">{t('verification.pendingText')}</p>
      <TrainingToggle checked={attempt.consentTraining} api={api} onSaved={onSaved} />
    </Card>
  );
}

function VerifiedView({
  data,
  api,
  onSaved,
}: {
  data: MyVerification;
  api: VerificationApi;
  onSaved: (next: MyVerification) => void;
}) {
  const { t } = useLanguage();
  return (
    <Card>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-mint-mist text-shutter">
        <BadgeCheck size={24} aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-black text-pine">{t('verification.verifiedTitle')}</h2>
      <p className="mt-2 text-[15px] leading-6 text-sage">{t('verification.verifiedText')}</p>
      {data.attempt ? <TrainingToggle checked={data.attempt.consentTraining} api={api} onSaved={onSaved} /> : null}
      <Link href={profileHref()} className="mt-6 inline-flex text-sm font-extrabold text-shutter hover:underline">
        {t('verification.profileOpen')} →
      </Link>
    </Card>
  );
}
