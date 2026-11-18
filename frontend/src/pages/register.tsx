import { useRef, useState, type FormEvent } from 'react';
import { clearRoleCache } from '@/lib/role-cache';
import { clearAccountCache } from '@/lib/account-cache';
import { Link, useLocation } from 'wouter';
import { Mail, Lock, EyeOff, Eye, MailCheck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/layout/auth-shell';
import { TurnstileWidget } from '@/components/shared/turnstile';
import { OAuthButtons } from '@/components/shared/oauth-buttons';
import { restoreSession, type AuthUser } from '@/lib/auth-session';
import { postAuthRoute } from '@/lib/auth-role';
import { APP_ROUTES, PASSWORD_FIELD_PLACEHOLDER, SHARED_TEST_IDS } from '@/lib/constants';
import { API_BASE_PATH, API_ROUTE_PATHS, PASSWORD_REQUIREMENTS_PATTERN, REGISTER_ERROR_CODES } from '@workspace/api-zod';
import { trackEvent } from '@/lib/analytics';
import { UserFacingError, userFacingMessage } from '@/lib/api-error';

// ===================== CONFIGURATION =====================

/** Stable selectors specific to the registration form. */
const REGISTER_TEST_IDS = {
  FORM_REGISTER: 'form-register',
  LINK_GO_LOGIN: 'link-go-login',
  STATUS_CHECK_EMAIL: 'status-check-email',
  BUTTON_CHANGE_EMAIL: 'button-change-email',
  CHECK_ACCEPT_TERMS: 'check-accept-terms',
} as const;

/** Id of the consent checkbox and of its error line (linked with aria-describedby). */
const CONSENT_INPUT_ID = 'register-accept-terms' as const;
const CONSENT_ERROR_ID = 'register-accept-terms-error' as const;
/** The legal pages open in a new tab, so the half-filled form is not lost. */
const LEGAL_LINK_TARGET = { target: '_blank', rel: 'noopener noreferrer' } as const;
/** Status of a rate-limited request. */
const HTTP_TOO_MANY_REQUESTS = 429 as const;

/** What POST /api/register answers; every field may be missing on an unexpected reply. */
type RegisterResponseBody = { user?: AuthUser; code?: unknown };

/**
 * Signup asks only for email and password (or Google). Name, date of
 * birth, photo and the rest come right after, one question per screen, in the
 * onboarding (pages/onboarding.tsx).
 */
export function RegisterPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Bumped whenever we need to force the Turnstile widget to remount and
  // issue a fresh token (e.g. after a failed submit consumed the old one).
  const [turnstileKey, setTurnstileKey] = useState(0);
  // "I accept the Terms and Privacy Policy" (RMY-15): required for both the
  // email form and Google, because both can create a new account.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const consentRef = useRef<HTMLInputElement>(null);

  // Box not ticked: show the hint right under it and bring it into view
  // (the Google button sits at the top of the page, far from the box).
  function showConsentRequired() {
    setConsentError(true);
    consentRef.current?.focus();
    consentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // Friendly text for a refused signup, from the backend's code (RMY-14).
  function registerErrorText(code: unknown, status: number): string {
    switch (code) {
      case REGISTER_ERROR_CODES.CAPTCHA_FAILED:
        return t('auth.captchaRequired');
      case REGISTER_ERROR_CODES.WEAK_PASSWORD:
        return t('auth.passwordPattern');
      case REGISTER_ERROR_CODES.INVALID_EMAIL:
        return t('auth.emailInvalid');
      case REGISTER_ERROR_CODES.CONSENT_REQUIRED:
        return t('auth.consentRequired');
      case REGISTER_ERROR_CODES.TOO_MANY_REQUESTS:
        return t('auth.tooManyAttempts');
      default:
        return status === HTTP_TOO_MANY_REQUESTS ? t('auth.tooManyAttempts') : t('auth.registerError');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      showConsentRequired();
      return;
    }

    if (!new RegExp(PASSWORD_REQUIREMENTS_PATTERN).test(password)) {
      setError(t('auth.passwordPattern'));
      return;
    }

    if (!captchaToken) {
      setError(t('auth.captchaRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Registration goes through our own backend (POST /api/register) so the
      // signup rate limiter applies; the Turnstile token is forwarded to
      // Supabase, which verifies it server-side (see backend routes/auth.ts).
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.REGISTER}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The backend checks acceptedTerms again and saves when it was given.
        body: JSON.stringify({ email, password, captchaToken, acceptedTerms }),
      });
      // An empty or non-JSON reply (backend down, proxy error) must surface as a
      // normal error message, not a JSON.parse crash.
      const body = (await response.json().catch(() => ({}))) as RegisterResponseBody;

      if (!response.ok) {
        // The token is single-use: clear it and remount the widget so a retry gets a fresh one.
        setCaptchaToken(null);
        setTurnstileKey((key) => key + 1);
        // RMY-14: only our own translated texts, never the server's wording.
        throw new UserFacingError(registerErrorText(body.code, response.status));
      }

      // Waitlist sign-up completed: GA4 key event (sent only if the visitor accepted analytics).
      trackEvent('generate_lead', { method: 'waitlist' });

      if (body.user) {
        // Email confirmation disabled in Supabase: the account is already
        // logged in. Read the session from the cookies, as /login does.
        if (!(await restoreSession())) throw new UserFacingError(t('auth.registerError'));
        clearRoleCache();
        clearAccountCache();

        setLocation(await postAuthRoute(body.user));
        return;
      }

      // Email confirmation enabled: the link in the email opens the onboarding.
      setSentTo(email.trim());
    } catch (err) {
      // A network failure ("Failed to fetch") gets the generic text, never its own wording.
      setError(userFacingMessage(err, t('auth.registerError')));
    } finally {
      setIsSubmitting(false);
    }
  }

  const footer = (
    <p>
      {t('auth.hasAccount')}{' '}
      <Link
        href={APP_ROUTES.LOGIN}
        className="font-extrabold text-shutter hover:text-pine"
        data-testid={REGISTER_TEST_IDS.LINK_GO_LOGIN}
      >
        {t('auth.loginCta')}
      </Link>
    </p>
  );

  if (sentTo) {
    return (
      <AuthShell title={t('auth.checkEmailTitle')} subtitle={t('auth.checkEmailSubtitle')} footer={footer}>
        <div className="rounded-2xl border border-hairline bg-paper p-6 shadow-rest" role="status" data-testid={REGISTER_TEST_IDS.STATUS_CHECK_EMAIL}>
          <span className="grid h-12 w-12 place-items-center rounded-[20px] bg-mint-mist text-shutter" aria-hidden>
            <MailCheck size={22} />
          </span>
          <p className="mt-4 text-[15px] leading-6 text-ink">
            {t('auth.checkEmailSentTo')} <span className="font-extrabold text-pine">{sentTo}</span>
          </p>
          <p className="mt-2 text-sm leading-6 text-sage">{t('auth.checkEmailHint')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSentTo(null);
            setPassword('');
          }}
          className="mt-5 text-sm font-extrabold text-shutter hover:text-pine"
          data-testid={REGISTER_TEST_IDS.BUTTON_CHANGE_EMAIL}
        >
          {t('auth.checkEmailWrongAddress')}
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')} footer={footer}>
      <OAuthButtons consent={{ accepted: acceptedTerms, onMissing: showConsentRequired }} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid={REGISTER_TEST_IDS.FORM_REGISTER}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-email">{t('auth.emailLabel')}</Label>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage" />
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="pl-9"
              data-testid={SHARED_TEST_IDS.INPUT_EMAIL}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-password">{t('auth.passwordLabel')}</Label>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage" />
            <Input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              placeholder={PASSWORD_FIELD_PLACEHOLDER}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pl-9 pr-10"
              aria-describedby="register-password-hint"
              data-testid={SHARED_TEST_IDS.INPUT_PASSWORD}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-sage transition-colors hover:text-pine"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPassword ? <Eye size={16} className="pointer-events-none" /> : <EyeOff size={16} className="pointer-events-none" />}
            </button>
          </div>
          <p id="register-password-hint" className="text-xs leading-5 text-sage">{t('auth.passwordHint')}</p>
        </div>

        {/* Consent (RMY-15). The whole label is the tap target; the links open the texts in a new tab. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={CONSENT_INPUT_ID} className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6 text-ink">
            <input
              ref={consentRef}
              id={CONSENT_INPUT_ID}
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => {
                setAcceptedTerms(event.target.checked);
                if (event.target.checked) setConsentError(false);
              }}
              aria-invalid={consentError}
              aria-describedby={consentError ? CONSENT_ERROR_ID : undefined}
              className="mt-1 h-4 w-4 shrink-0 accent-shutter"
              data-testid={REGISTER_TEST_IDS.CHECK_ACCEPT_TERMS}
            />
            <span>
              {t('auth.consentPrefix')}
              <a href={APP_ROUTES.TERMS} {...LEGAL_LINK_TARGET} className="font-extrabold text-shutter underline underline-offset-2 hover:text-pine">
                {t('auth.consentTerms')}
              </a>
              {t('auth.consentMiddle')}
              <a href={APP_ROUTES.PRIVACY} {...LEGAL_LINK_TARGET} className="font-extrabold text-shutter underline underline-offset-2 hover:text-pine">
                {t('auth.consentPrivacy')}
              </a>
              {t('auth.consentSuffix')}
            </span>
          </label>
          {consentError ? (
            <p id={CONSENT_ERROR_ID} className="text-sm font-semibold text-terracotta" role="alert">
              {t('auth.consentRequired')}
            </p>
          ) : null}
        </div>

        <div>
          <TurnstileWidget
            key={turnstileKey}
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
          />
        </div>

        {error ? (
          <p className="text-sm font-semibold text-terracotta" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !captchaToken}
          data-testid={SHARED_TEST_IDS.BUTTON_SEARCH}
          className="mt-2 h-12 w-full rounded-xl bg-shutter px-4 font-extrabold text-mint-mist transition-colors hover:bg-pine disabled:opacity-50"
        >
          {isSubmitting ? t('auth.registering') : t('auth.registerSubmit')}
        </button>
      </form>
    </AuthShell>
  );
}
