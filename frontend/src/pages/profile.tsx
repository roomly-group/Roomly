import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { BadgeCheck, Camera, Clock, Database, Download, Loader2, Lock, Settings, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  ACCOUNT_DELETE_CONFIRMATION,
  ACCOUNT_DELETE_ERROR_CODES,
  API_BASE_PATH,
  API_ROUTE_PATHS,
  EMAIL_CHANGE_ERROR_CODES,
  EMAIL_CHANGE_METHODS,
  PROFILE_BIO_MAX_LENGTH_CHARS,
  USER_PREFERENCE_OPTIONS,
  type EmailChangeMethod,
  type UserPreferences,
} from '@workspace/api-zod';
import { clearAuthSession } from '@/lib/auth-session';
import { useLanguage } from '@/lib/i18n';
import { TurnstileWidget } from '@/components/shared/turnstile';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { Button } from '@/components/shared/button';
import { LanguageSetting } from '@/components/language-selector';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { clearRoleCache } from '@/lib/role-cache';
import { clearAccountCache, patchAccount, useAccount } from '@/lib/account-cache';
import { APP_ROUTES, PASSWORD_FIELD_PLACEHOLDER } from '@/lib/constants';
import { fetchOnboarding, fromBoolean, isAdult, toBoolean, type OnboardingData, type YesNoAny } from '@/lib/onboarding';
import { ChipGroup, ChoiceChip } from '@/components/onboarding/choice';
import { BirthDatePicker } from '@/components/shared/birth-date-picker';
import { PROFILE_PHOTO_ACCEPT, PhotoReadError, shrinkPhoto, uploadProfilePhoto } from '@/lib/profile-photo';
import { useMyVerification } from '@/hooks/use-verification';

// ===================== CONFIGURATION =====================

/** Stable test selectors used by profile editing controls. */
const PROFILE_TEST_IDS = {
  STATUS_PROFILE_EDITING: 'status-profile-editing',
  BUTTON_PROFILE_SETTINGS: 'button-profile-settings',
  BUTTON_SAVE_PROFILE: 'button-save-profile',
} as const;

/** Rows of the "About you" textarea in the edit form. */
const BIO_TEXTAREA_ROWS = 4 as const;
/** How the date of birth is written in "Personal information". */
const BIRTH_DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
/** Same text field look as the onboarding "About you" step. */
const TEXTAREA_CLASS =
  'w-full resize-none rounded-xl border border-field bg-paper px-3.5 py-3 text-base leading-7 text-ink transition-[border-color,box-shadow] placeholder:text-sage-placeholder focus-visible:border-shutter focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mint-wash/40';
/** Destructive (Terracotta) button, same shape as the shared Button (DESIGN.md "button-destructive"). */
const DESTRUCTIVE_BUTTON_CLASS =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-terracotta px-5 py-2.5 text-sm font-extrabold text-paper transition-all duration-200 hover:bg-terracotta/90 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50';
/** Name of the downloaded data file when the server does not send one. */
const EXPORT_FALLBACK_FILE_NAME = 'roomly-my-data.json' as const;
/** Stable test selectors of the "Your data" section. */
const ACCOUNT_DATA_TEST_IDS = {
  SECTION: 'section-account-data',
  BUTTON_EXPORT: 'button-export-data',
  BUTTON_DELETE: 'button-delete-account',
  INPUT_CONFIRM: 'input-delete-confirm',
  BUTTON_CONFIRM_DELETE: 'button-confirm-delete-account',
  BUTTON_REAUTH: 'button-delete-reauth',
} as const;

/** Longest one-time code Supabase can email (digits). */
const EMAIL_CODE_MAX_LENGTH = 10 as const;
/** Stable test selectors of the email-change check (password or emailed code). */
const EMAIL_CHANGE_TEST_IDS = {
  SECTION: 'email-change-check',
  INPUT_PASSWORD: 'input-profile-email-password',
  INPUT_CODE: 'input-profile-email-code',
  BUTTON_SEND_CODE: 'button-send-email-code',
} as const;

/** data_nascita is "yyyy-MM-dd" or '' (not set); bio is '' when empty. */
type ProfileDraft = { nome: string; cognome: string; email: string; data_nascita: string; bio: string };

type Translate = ReturnType<typeof useLanguage>['t'];

/** Plain-language reason for a refused email change (PATCH /api/me/email or POST /api/me/email/code). */
async function emailChangeErrorText(response: Response, t: Translate, fallback: string): Promise<string> {
  let code: unknown;
  try {
    code = ((await response.json()) as { code?: unknown }).code;
  } catch {
    // No JSON body: fall back to the status below.
  }
  switch (code) {
    case EMAIL_CHANGE_ERROR_CODES.WRONG_PASSWORD:
      return t('profile.emailWrongPassword');
    case EMAIL_CHANGE_ERROR_CODES.WRONG_CODE:
      return t('profile.emailWrongCode');
    case EMAIL_CHANGE_ERROR_CODES.CAPTCHA_FAILED:
      return t('auth.captchaRequired');
    case EMAIL_CHANGE_ERROR_CODES.EMAIL_IN_USE:
      return t('profile.emailInUse');
    case EMAIL_CHANGE_ERROR_CODES.INVALID_EMAIL:
      return t('profile.emailInvalid');
    case EMAIL_CHANGE_ERROR_CODES.TOO_MANY_REQUESTS:
      return t('profile.emailTooMany');
    default:
      return response.status === 429 ? t('profile.emailTooMany') : fallback;
  }
}

async function profileError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') return new Error(body.error);
  } catch {
    // Fall back to the HTTP status when the server did not return JSON.
  }
  return new Error(`Request failed (${response.status})`);
}

function InfoRow({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl bg-mint-mist px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-sage">{label}</p>
      {loading ? (
        <Skeleton className="mt-1.5 h-4 w-20" />
      ) : (
        <p className="mt-1 whitespace-pre-line break-words text-sm font-extrabold text-pine [overflow-wrap:anywhere]">{value}</p>
      )}
    </div>
  );
}

export function ProfilePage({ owner = false }: { owner?: boolean }) {
  const { t, language } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>({ nome: '', cognome: '', email: '', data_nascita: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  // Same shared /api/me cache as the header: shown instantly after the first load.
  const { account: profile, loading } = useAccount();
  // Date of birth, bio and the search answers live in GET /api/me/onboarding.
  // Loaded once here and shared with "Your preferences" so the page makes one call.
  const [details, setDetails] = useState<OnboardingData | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  // Under review or verified: name, surname and date of birth are the ones checked
  // against the document, so they are read-only (the backend refuses changes too).
  const verification = useMyVerification();
  const identityLocked = verification.data?.identityLocked === true;
  // Email change needs proof it's really the user: their current password,
  // or (accounts without one, signed up with Google) a code sent by email.
  // Both go with a Turnstile check, which Supabase requires.
  const [emailMethod, setEmailMethod] = useState<EmailChangeMethod | null>(null);
  const [emailPassword, setEmailPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Bumped to remount Turnstile for a fresh single-use token after each attempt.
  const [turnstileKey, setTurnstileKey] = useState(0);
  const currentEmail = profile?.email?.trim().toLowerCase() ?? '';
  const emailChanged = editing && draft.email.trim().toLowerCase() !== currentEmail;

  useEffect(() => {
    let active = true;
    fetchOnboarding()
      .then((result) => active && setDetails(result))
      .catch(() => undefined)
      .finally(() => active && setDetailsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const birthText = details?.data_nascita
    ? new Intl.DateTimeFormat(language, BIRTH_DATE_FORMAT).format(new Date(`${details.data_nascita}T00:00:00`))
    : '—';

  const displayName = profile?.full_name?.trim() || profile?.email || 'Utente';

  function openEditor() {
    setDraft({
      nome: profile?.nome ?? '',
      cognome: profile?.cognome ?? '',
      email: profile?.email ?? '',
      data_nascita: details?.data_nascita ?? '',
      bio: details?.bio ?? '',
    });
    setSaveError(null);
    setSaveMessage(null);
    resetEmailCheck();
    setEditing(true);
    // Which proof the email change needs (asked once per page).
    if (!emailMethod) {
      fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_EMAIL}`, { credentials: 'include' })
        .then((response) => (response.ok ? (response.json() as Promise<{ method?: unknown }>) : null))
        .then((body) => {
          if (body?.method === EMAIL_CHANGE_METHODS.PASSWORD || body?.method === EMAIL_CHANGE_METHODS.CODE) {
            setEmailMethod(body.method);
          }
        })
        .catch(() => undefined);
    }
  }

  function resetEmailCheck() {
    setEmailPassword('');
    setEmailCode('');
    setCodeSent(false);
    setCaptchaToken(null);
    setTurnstileKey((key) => key + 1);
  }

  // Accounts without a password: email a one-time code to the current address.
  async function sendEmailCode() {
    setSaveError(null);
    if (!captchaToken) {
      setSaveError(t('auth.captchaRequired'));
      return;
    }
    setSendingCode(true);
    try {
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_EMAIL_CODE}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captchaToken }),
      });
      if (!response.ok) {
        setSaveError(await emailChangeErrorText(response, t, t('profile.codeSendError')));
        return;
      }
      setCodeSent(true);
    } catch {
      setSaveError(t('profile.codeSendError'));
    } finally {
      // The Turnstile token was used: get a fresh one in case they ask for a new code.
      setSendingCode(false);
      setCaptchaToken(null);
      setTurnstileKey((key) => key + 1);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaveMessage(null);

    const nome = draft.nome.trim();
    const cognome = draft.cognome.trim();
    const email = draft.email.trim().toLowerCase();
    if (!nome || !cognome) {
      setSaveError(t('profile.nameRequired'));
      return;
    }
    if (draft.data_nascita && !isAdult(draft.data_nascita)) {
      setSaveError(t('auth.ageUnder18'));
      return;
    }
    // Email change: check the proof is filled in before saving anything.
    if (email !== currentEmail) {
      if (!emailMethod) {
        setSaveError(t('profile.emailChangeError'));
        return;
      }
      if (emailMethod === EMAIL_CHANGE_METHODS.PASSWORD && !emailPassword) {
        setSaveError(t('profile.emailPasswordRequired'));
        return;
      }
      if (emailMethod === EMAIL_CHANGE_METHODS.CODE && !emailCode.trim()) {
        setSaveError(t('profile.emailCodeRequired'));
        return;
      }
      if (emailMethod === EMAIL_CHANGE_METHODS.PASSWORD && !captchaToken) {
        setSaveError(t('auth.captchaRequired'));
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_PROFILE}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cognome }),
      });
      if (!response.ok) throw await profileError(response);

      const updatedProfile = (await response.json()) as {
        nome: string;
        cognome: string;
        email: string;
        full_name: string;
        posizione?: number | null;
        lingua?: string | null;
      };
      patchAccount(updatedProfile);

      // Date of birth and bio: only the fields that changed. Skipped when they
      // never loaded, so a failed load can't wipe the saved bio. A date can be
      // changed but not removed (the backend requires a valid one).
      if (details) {
        const bio = draft.bio.trim();
        const changes: { data_nascita?: string; bio?: string | null } = {};
        if (draft.data_nascita && draft.data_nascita !== details.data_nascita) changes.data_nascita = draft.data_nascita;
        if (bio !== (details.bio ?? '')) changes.bio = bio || null;
        if (Object.keys(changes).length > 0) {
          const detailsResponse = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_ONBOARDING}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(changes),
          });
          if (!detailsResponse.ok) throw await profileError(detailsResponse);
          setDetails((await detailsResponse.json()) as OnboardingData);
        }
      }

      if (email !== currentEmail) {
        // The backend checks the password (or code) and asks Supabase for the
        // change; the session tokens never pass through this page.
        const emailResponse = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_EMAIL}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            emailMethod === EMAIL_CHANGE_METHODS.PASSWORD
              ? { email, password: emailPassword, captchaToken }
              : { email, code: emailCode.trim() },
          ),
        });
        if (!emailResponse.ok) {
          // The Turnstile token is single-use: get a fresh one for the next try.
          setCaptchaToken(null);
          setTurnstileKey((key) => key + 1);
          setSaveError(
            `${t('profile.nameSavedEmailFailed')} ${await emailChangeErrorText(emailResponse, t, t('profile.emailChangeError'))}`,
          );
          return;
        }

        const result = (await emailResponse.json()) as { pending?: boolean };
        if (result.pending === false) {
          patchAccount({ email });
          setSaveMessage(t('profile.saved'));
        } else {
          setSaveMessage(t('profile.emailConfirmationSent'));
        }
        resetEmailCheck();
      } else {
        setSaveMessage(t('profile.saved'));
      }
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[920px] px-5 py-8 lg:px-8 lg:py-12">
        <PageIntro
          eyebrow={owner ? t('profile.ownerEyebrow') : t('profile.studentEyebrow')}
          title={owner ? t('profile.ownerTitle') : t('profile.studentTitle')}
          description={owner ? t('profile.ownerDescription') : t('profile.studentDescription')}
        />

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="surface h-fit rounded-2xl p-5 text-center">
            {loading ? <Skeleton className="mx-auto h-28 w-28 rounded-full" /> : <ProfilePhoto name={displayName} url={profile?.foto_profilo_url ?? null} />}
            {loading ? (
              <Skeleton className="mx-auto mt-3 h-5 w-32" />
            ) : (
              <h2 className="mt-3 text-lg font-black text-[#085041]">{displayName}</h2>
            )}
            {loading ? (
              <Skeleton className="mx-auto mt-1.5 h-4 w-40" />
            ) : (
              <p className="mt-1 text-sm text-[#527067]">{profile?.email ?? ''}</p>
            )}
            {owner ? (
              <>
                <div className="my-5 border-t border-[#e1ebe4]" />
                <Link
                  href={APP_ROUTES.OWNER_PROFILE_PREFERENCES}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#0850411a] px-4 py-3 text-sm font-extrabold text-[#085041] transition-colors hover:border-[#08504140] hover:bg-[#E1F5EE]"
                  data-testid="link-profile-preferences"
                >
                  <SlidersHorizontal size={16} />
                  {t('preferences.open')}
                </Link>
              </>
            ) : null}
            <VerificationCard query={verification} />
          </aside>

          <div className="space-y-5">
            <section data-reveal className="surface rounded-2xl p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="mt-1 text-xl font-black text-[#085041]">{t('profile.usefulBits')}</h2>
                </div>
                <button
                  type="button"
                  onClick={editing ? () => setEditing(false) : openEditor}
                  disabled={loading || saving}
                  className="rounded-lg p-2 text-[#0F6E56] hover:bg-[#E1F5EE]"
                  data-testid={PROFILE_TEST_IDS.BUTTON_PROFILE_SETTINGS}
                  aria-label={editing ? t('profile.closeEditor') : t('profile.profileSettings')}
                  aria-expanded={editing}
                >
                  <Settings size={18} />
                </button>
              </div>
              {editing ? (
                <form onSubmit={saveProfile} className="space-y-5" data-testid="form-profile-edit">
                  {identityLocked ? (
                    <p className="flex items-start gap-2 rounded-xl bg-mint-mist px-4 py-3 text-sm font-bold text-pine" role="note" data-testid="note-identity-locked">
                      <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
                      {t('verification.lockedNote')}
                    </p>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="profile-first-name">{t('auth.firstNameLabel')}</Label>
                      <Input
                        id="profile-first-name"
                        value={draft.nome}
                        maxLength={50}
                        onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))}
                        autoComplete="given-name"
                        required
                        readOnly={identityLocked}
                        aria-readonly={identityLocked}
                        className={identityLocked ? 'cursor-not-allowed bg-cream text-sage' : undefined}
                        data-testid="input-profile-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-last-name">{t('auth.lastNameLabel')}</Label>
                      <Input
                        id="profile-last-name"
                        value={draft.cognome}
                        maxLength={50}
                        onChange={(event) => setDraft((current) => ({ ...current, cognome: event.target.value }))}
                        autoComplete="family-name"
                        required
                        readOnly={identityLocked}
                        aria-readonly={identityLocked}
                        className={identityLocked ? 'cursor-not-allowed bg-cream text-sage' : undefined}
                        data-testid="input-profile-last-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-email">{t('profile.labelEmail')}</Label>
                      <Input
                        id="profile-email"
                        type="email"
                        value={draft.email}
                        onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                        autoComplete="email"
                        required
                        data-testid="input-profile-email"
                      />
                    </div>
                    {emailChanged ? (
                      // Shown only while the email differs from the current one.
                      <div className="space-y-3 rounded-xl bg-mint-mist px-4 py-4 sm:col-span-2" data-testid={EMAIL_CHANGE_TEST_IDS.SECTION}>
                        <p className="flex items-start gap-2 text-sm font-bold text-pine">
                          <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
                          {emailMethod === EMAIL_CHANGE_METHODS.CODE
                            ? t('profile.emailCodeHint').replace('{email}', profile?.email ?? '')
                            : t('profile.emailPasswordHint')}
                        </p>
                        {emailMethod === EMAIL_CHANGE_METHODS.PASSWORD ? (
                          <div className="space-y-2">
                            <Label htmlFor="profile-email-password">{t('profile.currentPasswordLabel')}</Label>
                            <Input
                              id="profile-email-password"
                              type="password"
                              value={emailPassword}
                              onChange={(event) => setEmailPassword(event.target.value)}
                              autoComplete="current-password"
                              placeholder={PASSWORD_FIELD_PLACEHOLDER}
                              data-testid={EMAIL_CHANGE_TEST_IDS.INPUT_PASSWORD}
                            />
                          </div>
                        ) : null}
                        {emailMethod === EMAIL_CHANGE_METHODS.CODE && codeSent ? (
                          <div className="space-y-2">
                            <Label htmlFor="profile-email-code">{t('profile.codeLabel')}</Label>
                            <Input
                              id="profile-email-code"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={EMAIL_CODE_MAX_LENGTH}
                              value={emailCode}
                              onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ''))}
                              data-testid={EMAIL_CHANGE_TEST_IDS.INPUT_CODE}
                            />
                            <p className="text-xs font-bold text-sage" role="status">{t('profile.codeSent')}</p>
                          </div>
                        ) : null}
                        {emailMethod ? (
                          <TurnstileWidget
                            key={turnstileKey}
                            onVerify={setCaptchaToken}
                            onExpire={() => setCaptchaToken(null)}
                            onError={() => setCaptchaToken(null)}
                          />
                        ) : null}
                        {emailMethod === EMAIL_CHANGE_METHODS.CODE ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void sendEmailCode()}
                            disabled={sendingCode || saving || !captchaToken}
                            data-testid={EMAIL_CHANGE_TEST_IDS.BUTTON_SEND_CODE}
                          >
                            {sendingCode ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                            {codeSent ? t('profile.resendCode') : t('profile.sendCode')}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {details ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="profile-birth-date">{t('auth.dateOfBirthLabel')}</Label>
                          {identityLocked ? (
                            <Input
                              id="profile-birth-date"
                              value={birthText}
                              readOnly
                              aria-readonly
                              className="cursor-not-allowed bg-cream text-sage"
                              data-testid="input-profile-birth-date"
                            />
                          ) : (
                            <BirthDatePicker
                              id="profile-birth-date"
                              value={draft.data_nascita}
                              onChange={(value) => setDraft((current) => ({ ...current, data_nascita: value }))}
                              testId="input-profile-birth-date"
                            />
                          )}
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="profile-bio">{t('profile.aboutLabel')}</Label>
                          <textarea
                            id="profile-bio"
                            rows={BIO_TEXTAREA_ROWS}
                            maxLength={PROFILE_BIO_MAX_LENGTH_CHARS}
                            placeholder={t('onboarding.aboutPlaceholder')}
                            value={draft.bio}
                            onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))}
                            className={TEXTAREA_CLASS}
                            aria-describedby="profile-bio-count"
                            data-testid="input-profile-bio"
                          />
                          <p id="profile-bio-count" className="text-right text-xs font-bold tabular-nums text-sage">
                            {draft.bio.length}/{PROFILE_BIO_MAX_LENGTH_CHARS}
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>
                  {saveError && <p className="text-sm font-semibold text-red-700" role="alert">{saveError}</p>}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-[#085041] px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#0F6E56] disabled:cursor-not-allowed disabled:opacity-60"
                      data-testid={PROFILE_TEST_IDS.BUTTON_SAVE_PROFILE}
                    >
                      {saving ? t('profile.saving') : t('profile.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      disabled={saving}
                      className="rounded-xl border border-[#0850411a] px-5 py-3 text-sm font-bold text-[#527067] transition-colors hover:bg-[#E1F5EE]"
                    >
                      {t('profile.cancel')}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <InfoRow label={t('auth.firstNameLabel')} value={profile?.nome || '—'} loading={loading} />
                    <InfoRow label={t('auth.lastNameLabel')} value={profile?.cognome || '—'} loading={loading} />
                    {/* Phones: first and last name share a row; email, date of birth and bio take the full width. */}
                    <div className="col-span-2 sm:col-span-1">
                      <InfoRow label={t('profile.labelEmail')} value={profile?.email ?? '—'} loading={loading} />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <InfoRow label={t('auth.dateOfBirthLabel')} value={birthText} loading={detailsLoading} />
                    </div>
                    <div className="col-span-2">
                      <InfoRow label={t('profile.aboutLabel')} value={details?.bio || '—'} loading={detailsLoading} />
                    </div>
                  </div>
                  {saveMessage && (
                    <p className="mt-4 text-sm font-semibold text-[#0F6E56]" role="status" data-testid={PROFILE_TEST_IDS.STATUS_PROFILE_EDITING}>
                      {saveMessage}
                    </p>
                  )}
                </>
              )}
            </section>

            {!owner && details ? <PreferencesSection data={details} onSaved={setDetails} /> : null}

            <LanguageSetting />

            {/* Kept last on purpose: download your data, then delete the account. */}
            <AccountDataSection />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ===================== YOUR DATA (EXPORT + ACCOUNT DELETION) =====================

/** Why a deletion did not go through; each one has its own friendly message. */
type DeleteProblem = 'reauth' | 'contracts' | 'tooMany' | 'generic';

/** `code` of a JSON error response, if any. */
async function responseErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { code?: unknown };
    return typeof body.code === 'string' ? body.code : undefined;
  } catch {
    return undefined;
  }
}

/** Upper case without accents, so "loschen" matches "LÖSCHEN" and "elimina" matches "ELIMINA". */
const normalizeConfirmWord = (value: string) =>
  value.trim().normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();

/** File name from a `Content-Disposition: attachment; filename="..."` header. */
function attachmentFileName(header: string | null): string {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? EXPORT_FALLBACK_FILE_NAME;
}

/** Ends the session in this browser: the logged-in user and cached profile/role. */
async function endLocalSession() {
  clearAuthSession();
  clearRoleCache();
  clearAccountCache();
}

/**
 * "Your data", at the bottom of the profile: download a copy of everything
 * Roomly stores about the user (GET /api/me/export), then delete the account
 * (DELETE /api/me). Deleting asks to type a word first, and the backend also
 * requires a login from the last few minutes.
 */
function AccountDataSection() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteProblem, setDeleteProblem] = useState<DeleteProblem | null>(null);

  const confirmWord = t('account.deleteConfirmWord');
  const confirmed = normalizeConfirmWord(confirmText) === normalizeConfirmWord(confirmWord);
  const [confirmLabelBefore, confirmLabelAfter] = t('account.deleteConfirmLabel').split('{word}');

  async function downloadData() {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_EXPORT}`, { credentials: 'include' });
      if (!response.ok) {
        setExportError(response.status === 429 ? t('account.deleteTooMany') : t('account.exportError'));
        return;
      }
      // Save the JSON through a temporary link, then free the memory it used.
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = attachmentFileName(response.headers.get('Content-Disposition'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t('account.exportError'));
    } finally {
      setExporting(false);
    }
  }

  function openDialog() {
    setConfirmText('');
    setDeleteProblem(null);
    setDialogOpen(true);
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || deleting) return;

    setDeleting(true);
    setDeleteProblem(null);
    try {
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: ACCOUNT_DELETE_CONFIRMATION }),
      });

      if (response.ok) {
        // The backend already cleared the session cookies.
        await endLocalSession();
        toast({ title: t('account.deleted') });
        setLocation(APP_ROUTES.ROOT);
        return;
      }

      const code = await responseErrorCode(response);
      setDeleteProblem(
        code === ACCOUNT_DELETE_ERROR_CODES.REAUTH_REQUIRED
          ? 'reauth'
          : code === ACCOUNT_DELETE_ERROR_CODES.HAS_CONTRACTS
            ? 'contracts'
            : response.status === 429
              ? 'tooMany'
              : 'generic',
      );
    } catch {
      setDeleteProblem('generic');
    } finally {
      setDeleting(false);
    }
  }

  // Log out completely and open the login page: the next login is "fresh"
  // and lets the user delete the account.
  async function logInAgain() {
    await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.LOGOUT}`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
    await endLocalSession();
    setLocation(APP_ROUTES.LOGIN);
  }

  const problemText: Record<DeleteProblem, string> = {
    reauth: t('account.deleteReauth'),
    contracts: t('account.deleteHasContracts'),
    tooMany: t('account.deleteTooMany'),
    generic: t('account.deleteError'),
  };

  return (
    <section className="surface rounded-2xl p-5 sm:p-6" aria-labelledby="account-data-title" data-testid={ACCOUNT_DATA_TEST_IDS.SECTION}>
      <h2 id="account-data-title" className="mb-5 flex items-center gap-2 text-xl font-black text-pine">
        <Database size={18} className="text-shutter" aria-hidden />
        {t('account.title')}
      </h2>

      {/* Download a copy of the data (GDPR right of access and portability). */}
      <div>
        <h3 className="text-[15px] font-black text-pine">{t('account.exportTitle')}</h3>
        <p className="mt-1 text-sm leading-6 text-sage">{t('account.exportText')}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void downloadData()}
          disabled={exporting}
          className="mt-4 min-h-12 w-full px-5 sm:w-auto"
          data-testid={ACCOUNT_DATA_TEST_IDS.BUTTON_EXPORT}
        >
          {exporting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
          {exporting ? t('account.exporting') : t('account.exportButton')}
        </Button>
        {exportError ? (
          <p className="mt-3 text-sm font-semibold text-terracotta" role="alert">
            {exportError}
          </p>
        ) : null}
      </div>

      {/* Delete the account (GDPR right to erasure). */}
      <div className="mt-6 border-t border-line pt-6">
        <h3 className="text-[15px] font-black text-pine">{t('account.deleteTitle')}</h3>
        <p className="mt-1 text-sm leading-6 text-sage">{t('account.deleteText')}</p>
        <button
          type="button"
          onClick={openDialog}
          className={`mt-4 w-full sm:w-auto ${DESTRUCTIVE_BUTTON_CLASS}`}
          data-testid={ACCOUNT_DATA_TEST_IDS.BUTTON_DELETE}
        >
          <Trash2 size={16} aria-hidden />
          {t('account.deleteButton')}
        </button>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={(open) => !deleting && setDialogOpen(open)}>
        <AlertDialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl bg-paper sm:max-w-md">
          <form onSubmit={deleteAccount} className="space-y-4" noValidate>
            <AlertDialogHeader className="text-left">
              <AlertDialogTitle className="text-xl font-black text-pine">{t('account.deleteDialogTitle')}</AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-6 text-ink">{t('account.deleteDialogIntro')}</AlertDialogDescription>
            </AlertDialogHeader>

            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-ink">
              <li>{t('account.deleteDialogProfile')}</li>
              <li>{t('account.deleteDialogListings')}</li>
              <li>{t('account.deleteDialogVerification')}</li>
            </ul>
            <p className="text-sm leading-6 text-sage">{t('account.deleteDialogChats')}</p>
            <p className="rounded-xl bg-mint-mist px-4 py-3 text-sm font-bold text-pine">{t('account.deleteDialogExportHint')}</p>

            <div className="space-y-2">
              <Label htmlFor="delete-account-confirm">
                {confirmLabelBefore}
                <span className="font-black text-terracotta">{confirmWord}</span>
                {confirmLabelAfter}
              </Label>
              <Input
                id="delete-account-confirm"
                value={confirmText}
                onChange={(event) => {
                  setConfirmText(event.target.value);
                  setDeleteProblem(null);
                }}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={deleting}
                aria-describedby={deleteProblem ? 'delete-account-problem' : undefined}
                data-testid={ACCOUNT_DATA_TEST_IDS.INPUT_CONFIRM}
              />
            </div>

            {deleteProblem ? (
              <div id="delete-account-problem" className="rounded-xl bg-terracotta-mist px-4 py-3 text-sm font-semibold text-terracotta" role="alert">
                <p>{problemText[deleteProblem]}</p>
                {deleteProblem === 'reauth' ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void logInAgain()}
                    className="mt-3 min-h-11 bg-paper"
                    data-testid={ACCOUNT_DATA_TEST_IDS.BUTTON_REAUTH}
                  >
                    {t('account.deleteReauthButton')}
                  </Button>
                ) : null}
                {deleteProblem === 'contracts' ? (
                  <Link href={APP_ROUTES.CONTACT} className="mt-2 inline-block font-extrabold text-pine underline underline-offset-2">
                    {t('account.deleteContactLink')}
                  </Link>
                ) : null}
              </div>
            ) : null}

            <AlertDialogFooter className="gap-2 sm:space-x-0">
              <AlertDialogCancel disabled={deleting} className="min-h-12 rounded-xl">
                {t('common.cancel')}
              </AlertDialogCancel>
              <button
                type="submit"
                disabled={!confirmed || deleting}
                className={DESTRUCTIVE_BUTTON_CLASS}
                data-testid={ACCOUNT_DATA_TEST_IDS.BUTTON_CONFIRM_DELETE}
              >
                {deleting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Trash2 size={16} aria-hidden />}
                {deleting ? t('account.deleting') : t('account.deleteConfirm')}
              </button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// ===================== IDENTITY VERIFICATION =====================

/** Where the user stands with the identity check, and the way to /verifica. */
function VerificationCard({ query }: { query: ReturnType<typeof useMyVerification> }) {
  const { t } = useLanguage();
  const { data, isLoading, isError } = query;
  if (isError) return null;

  const status = data?.verified ? 'verified' : data?.attempt?.status ?? 'none';
  const label =
    status === 'verified'
      ? t('verification.profileVerified')
      : status === 'in_attesa'
        ? t('verification.profilePending')
        : status === 'rifiutata'
          ? t('verification.profileRejected')
          : t('verification.profileNotVerified');
  const Icon = status === 'verified' ? BadgeCheck : status === 'in_attesa' ? Clock : ShieldCheck;

  return (
    <div className="mt-5 border-t border-[#e1ebe4] pt-5 text-left" data-testid="panel-profile-verification">
      <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-sage">{t('verification.profileTitle')}</p>
      {isLoading ? (
        <Skeleton className="mt-2 h-5 w-32" />
      ) : (
        <p className={`mt-1.5 flex items-center gap-1.5 text-sm font-black ${status === 'verified' ? 'text-shutter' : 'text-pine'}`}>
          <Icon size={16} aria-hidden />
          {label}
        </p>
      )}
      {/* Once verified there is nothing left to do on /verifica: no button. */}
      {status === 'verified' || isLoading ? null : (
        <Link
          href={APP_ROUTES.VERIFICATION}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#0850411a] px-4 py-2.5 text-sm font-extrabold text-[#085041] transition-colors hover:border-[#08504140] hover:bg-[#E1F5EE]"
          data-testid="link-verification"
        >
          {status === 'in_attesa' ? t('verification.profileOpen') : t('verification.profileStart')}
        </Link>
      )}
    </div>
  );
}

// ===================== PHOTO =====================

/** Big avatar with the profile photo; choosing a file shrinks it, uploads it and updates the header at once. */
function ProfilePhoto({ name, url }: { name: string; url: string | null }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      patchAccount({ foto_profilo_url: await uploadProfilePhoto(await shrinkPhoto(file)) });
    } catch (uploadError) {
      setError(t(uploadError instanceof PhotoReadError ? 'onboarding.photoReadError' : 'onboarding.photoUploadError'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shutter"
        aria-label={url ? t('profile.photoChange') : t('profile.photoAdd')}
        data-testid="button-profile-photo"
      >
        <Avatar name={name} size="xl" src={url} />
        <span className="absolute bottom-0.5 right-0.5 grid h-9 w-9 place-items-center rounded-full border-2 border-paper bg-shutter text-mint-mist shadow-rest" aria-hidden>
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
        </span>
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mt-2 text-sm font-extrabold text-shutter hover:text-pine"
      >
        {url ? t('profile.photoChange') : t('profile.photoAdd')}
      </button>
      {error ? (
        <p className="mt-1 text-xs font-semibold text-terracotta" role="alert">
          {error}
        </p>
      ) : null}
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
        data-testid="input-profile-photo"
      />
    </div>
  );
}

// ===================== PREFERENCES =====================

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
const YES_NO_LABELS = {
  yes: 'preferences.yes',
  no: 'preferences.no',
  any: 'preferences.noPreference',
} as const;
const YES_NO_OPTIONS = ['yes', 'no', 'any'] as const;
/** A key of the translations (the type `t` accepts). */
type TextKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

/** The six answers as the chips hold them; null = not answered yet. */
type PreferencesDraft = {
  pets: YesNoAny | null;
  smoking: YesNoAny | null;
  noise: UserPreferences['livello_rumore_preferito'] | null;
  cleanliness: UserPreferences['ordine_pulizia'] | null;
  schedule: UserPreferences['orari_sosta'] | null;
  study: UserPreferences['abitudini_studio'] | null;
};

/**
 * Saved preferences -> chips. Pets and smoking are stored as true/false/null,
 * so once a preference row exists, null is shown as "No preference".
 */
function draftFrom(prefs: UserPreferences | null): PreferencesDraft {
  const yesNo = (value: boolean | null | undefined) => fromBoolean(value) ?? (prefs ? 'any' : null);
  return {
    pets: yesNo(prefs?.animali),
    smoking: yesNo(prefs?.fumatori),
    noise: prefs?.livello_rumore_preferito ?? null,
    cleanliness: prefs?.ordine_pulizia ?? null,
    schedule: prefs?.orari_sosta ?? null,
    study: prefs?.abitudini_studio ?? null,
  };
}

/** One question with its chips; picking a chip only changes the draft until Save. */
function PreferenceGroup<T extends string>({
  legend,
  name,
  options,
  labels,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  labels: Record<T, TextKey>;
  value: T | null;
  onChange: (next: T) => void;
}) {
  const { t } = useLanguage();
  return (
    <ChipGroup legend={legend}>
      {options.map((option) => (
        <ChoiceChip key={option} name={name} value={option} checked={value === option} onSelect={() => onChange(option)}>
          {t(labels[option])}
        </ChoiceChip>
      ))}
    </ChipGroup>
  );
}

/**
 * Students' home habits (same questions as the onboarding lifestyle screen).
 * The six questions sit right inside the card, in two columns from sm up.
 * Picking a chip only changes a draft; "Save changes" sends it to the backend.
 */
function PreferencesSection({ data, onSaved }: { data: OnboardingData; onSaved: (updated: OnboardingData) => void }) {
  const { t } = useLanguage();
  const saved = draftFrom(data.preferenze);
  const [draft, setDraft] = useState<PreferencesDraft>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // After a save the parent passes the new answers: the draft follows them.
  useEffect(() => {
    setDraft(draftFrom(data.preferenze));
  }, [data.preferenze]);

  // Save stays disabled until at least one answer differs from what is saved.
  const changed = (Object.keys(draft) as (keyof PreferencesDraft)[]).some((key) => draft[key] !== saved[key]);

  function set<K extends keyof PreferencesDraft>(key: K, value: PreferencesDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
    setMessage(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed || saving) return;

    // Only answered questions are sent; the backend validates every value.
    const preferenze: Partial<UserPreferences> = {};
    if (draft.pets) preferenze.animali = toBoolean(draft.pets);
    if (draft.smoking) preferenze.fumatori = toBoolean(draft.smoking);
    if (draft.noise) preferenze.livello_rumore_preferito = draft.noise;
    if (draft.cleanliness) preferenze.ordine_pulizia = draft.cleanliness;
    if (draft.schedule) preferenze.orari_sosta = draft.schedule;
    if (draft.study) preferenze.abitudini_studio = draft.study;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_ONBOARDING}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferenze }),
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      onSaved((await response.json()) as OnboardingData);
      setMessage(t('profile.searchSaved'));
    } catch {
      // Friendly text only: the technical reason stays out of the page.
      setError(t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface rounded-2xl p-5 sm:p-6" data-testid="panel-profile-preferences">
      <h2 className="mb-5 text-xl font-black text-pine">{t('profile.searchTitle')}</h2>

      <form onSubmit={save} noValidate>
        {/* Phones: one question per row. From sm: two columns. */}
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <PreferenceGroup legend={t('onboarding.lifestylePets')} name="profile-animali" options={YES_NO_OPTIONS} labels={YES_NO_LABELS} value={draft.pets} onChange={(v) => set('pets', v)} />
          <PreferenceGroup legend={t('onboarding.lifestyleSmoking')} name="profile-fumatori" options={YES_NO_OPTIONS} labels={YES_NO_LABELS} value={draft.smoking} onChange={(v) => set('smoking', v)} />
          <PreferenceGroup legend={t('preferences.noise')} name="profile-rumore" options={USER_PREFERENCE_OPTIONS.noise} labels={NOISE_LABELS} value={draft.noise} onChange={(v) => set('noise', v)} />
          <PreferenceGroup legend={t('preferences.cleanliness')} name="profile-pulizia" options={USER_PREFERENCE_OPTIONS.cleanliness} labels={CLEANLINESS_LABELS} value={draft.cleanliness} onChange={(v) => set('cleanliness', v)} />
          <PreferenceGroup legend={t('preferences.schedule')} name="profile-orari" options={USER_PREFERENCE_OPTIONS.schedule} labels={SCHEDULE_LABELS} value={draft.schedule} onChange={(v) => set('schedule', v)} />
          <PreferenceGroup legend={t('preferences.study')} name="profile-studio" options={USER_PREFERENCE_OPTIONS.studyHabits} labels={STUDY_LABELS} value={draft.study} onChange={(v) => set('study', v)} />
        </div>

        {error ? (
          <p className="mt-5 text-sm font-semibold text-terracotta" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-5 text-sm font-semibold text-shutter" role="status" data-testid="status-preferences-saved">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!changed || saving}
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-shutter px-5 text-[15px] font-extrabold text-mint-mist transition-colors hover:bg-pine disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="button-save-preferences"
        >
          {saving ? <Loader2 size={17} className="animate-spin" aria-hidden /> : null}
          {saving ? t('profile.saving') : t('profile.save')}
        </button>
      </form>
    </section>
  );
}

export function StudentProfileRoute() {
  return <ProfilePage />;
}

export function OwnerProfileRoute() {
  return <ProfilePage owner />;
}