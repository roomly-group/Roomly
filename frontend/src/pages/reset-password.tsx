import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Mail, Lock, Eye, EyeOff, MailCheck, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/layout/auth-shell';
import { TurnstileWidget } from '@/components/shared/turnstile';
import { restoreSession, type AuthUser } from '@/lib/auth-session';
import { postAuthRoute } from '@/lib/auth-role';
import { clearRoleCache } from '@/lib/role-cache';
import { clearAccountCache } from '@/lib/account-cache';
import { APP_ROUTES, PASSWORD_FIELD_PLACEHOLDER, SHARED_TEST_IDS } from '@/lib/constants';
import {
  ACCOUNT_SUSPENDED_ERROR_CODE,
  API_BASE_PATH,
  API_ROUTE_PATHS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_REQUIREMENTS_PATTERN,
  PASSWORD_RESET_ERROR_CODES,
  PASSWORD_RESET_TOKEN_QUERY_PARAM,
} from '@workspace/api-zod';

// Password reset (audit finding RMY-11). One page, two jobs:
// - opened from "Forgot your password?" on the login page: asks for the email
//   and has the backend send the reset link (POST /api/password/forgot);
// - opened from that link (/reset-password?token_hash=…): asks for the new
//   password and sends it with the token (POST /api/password/reset). The
//   backend then logs the user in here and out everywhere else.
// The link works on any device: it does not depend on this browser.

// ===================== CONFIGURATION =====================

/** Longest token we accept from the URL (characters); the backend checks the exact shape. */
const TOKEN_HASH_MAX_LENGTH = 256 as const;

/** Stable selectors specific to the reset-password page. */
const RESET_TEST_IDS = {
  FORM_REQUEST: 'form-reset-request',
  FORM_NEW_PASSWORD: 'form-reset-new-password',
  STATUS_SENT: 'status-reset-sent',
  STATUS_DONE: 'status-reset-done',
  BUTTON_OTHER_EMAIL: 'button-reset-other-email',
  BUTTON_NEW_LINK: 'button-reset-new-link',
  BUTTON_CONTINUE: 'button-reset-continue',
  LINK_GO_LOGIN: 'link-reset-go-login',
} as const;

/** Shared look of the full-width primary submit buttons (same as login/register). */
const PRIMARY_BUTTON_CLASS =
  'mt-2 h-12 w-full rounded-xl bg-shutter px-4 font-extrabold text-mint-mist transition-colors hover:bg-pine disabled:opacity-50' as const;
/** Shared look of the status cards ("check your inbox", "password updated"). */
const STATUS_CARD_CLASS = 'rounded-2xl border border-hairline bg-paper p-6 shadow-rest' as const;
/** Shared look of the icon well at the top of a status card. */
const STATUS_ICON_CLASS = 'grid h-12 w-12 place-items-center rounded-[20px] bg-mint-mist text-shutter' as const;
/** Shared look of the text buttons (secondary actions under a card or form). */
const TEXT_BUTTON_CLASS = 'mt-5 min-h-11 text-sm font-extrabold text-shutter hover:text-pine' as const;

// ===================== HELPERS =====================

type Step = 'request' | 'sent' | 'new' | 'done';
type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];
type ApiAnswer = { ok: boolean; body: { code?: string; linkUsed?: boolean; session?: { user?: AuthUser } } };

/** The token from the reset link, or null. Only read here, never shown or stored. */
function readTokenHash(): string | null {
  const value = new URLSearchParams(window.location.search).get(PASSWORD_RESET_TOKEN_QUERY_PARAM);
  return value && value.length <= TOKEN_HASH_MAX_LENGTH ? value : null;
}

/** POST JSON to our API. A non-JSON or network failure becomes a normal error answer, never a crash. */
async function postJson(path: string, payload: unknown): Promise<ApiAnswer> {
  try {
    const response = await fetch(`${API_BASE_PATH}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include', // the backend sets (and reads) HttpOnly cookies on these routes
    });
    const body = (await response.json().catch(() => ({}))) as ApiAnswer['body'];
    return { ok: response.ok, body };
  } catch {
    return { ok: false, body: {} };
  }
}

/** Friendly, translated text for an error `code` from the backend. */
function errorTextKey(code: string | undefined): TranslationKey {
  switch (code) {
    case PASSWORD_RESET_ERROR_CODES.CAPTCHA_FAILED:
      return 'auth.captchaRequired';
    case PASSWORD_RESET_ERROR_CODES.INVALID_EMAIL:
      return 'resetPassword.errorInvalidEmail';
    case PASSWORD_RESET_ERROR_CODES.INVALID_LINK:
      return 'resetPassword.errorInvalidLink';
    case PASSWORD_RESET_ERROR_CODES.WEAK_PASSWORD:
      return 'resetPassword.errorWeakPassword';
    case PASSWORD_RESET_ERROR_CODES.SAME_PASSWORD:
      return 'resetPassword.errorSamePassword';
    case PASSWORD_RESET_ERROR_CODES.TOO_MANY_REQUESTS:
      return 'resetPassword.errorTooMany';
    case ACCOUNT_SUSPENDED_ERROR_CODE:
      return 'auth.accountSuspended';
    default:
      return 'resetPassword.errorGeneric';
  }
}

// ===================== PAGE =====================

export function ResetPasswordPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  // Token from the emailed link. Set to null once the backend says the link
  // is used up: retries then rely on the backend's short-lived recovery cookie.
  const [tokenHash, setTokenHash] = useState<string | null>(readTokenHash);
  const [step, setStep] = useState<Step>(() => (readTokenHash() ? 'new' : 'request'));
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The link is expired or used: show the "send me a new link" way out.
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Bumped to remount Turnstile and get a fresh token after a failed submit.
  const [turnstileKey, setTurnstileKey] = useState(0);

  // Remove the token from the address bar (and so from the browser history)
  // as soon as the page opens. replaceState: no new history entry.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PASSWORD_RESET_TOKEN_QUERY_PARAM)) return;
    url.searchParams.delete(PASSWORD_RESET_TOKEN_QUERY_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  function goTo(next: Step) {
    setError(null);
    setLinkInvalid(false);
    setStep(next);
  }

  // Step 1: send the reset email. Same answer whether or not the account exists.
  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!captchaToken) {
      setError(t('auth.captchaRequired'));
      return;
    }
    setIsSubmitting(true);
    const { ok, body } = await postJson(API_ROUTE_PATHS.PASSWORD_FORGOT, { email, captchaToken });
    // The Turnstile token is single-use: always get a fresh one.
    setCaptchaToken(null);
    setTurnstileKey((key) => key + 1);
    setIsSubmitting(false);
    if (!ok) {
      setError(t(errorTextKey(body.code)));
      return;
    }
    setSentTo(email.trim());
    goTo('sent');
  }

  // Step 2: save the new password with the token from the link.
  async function handleNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLinkInvalid(false);
    // Same rules as signup, checked here first so the link is never used up for nothing.
    if (!new RegExp(PASSWORD_REQUIREMENTS_PATTERN).test(password)) {
      setError(t('auth.passwordPattern'));
      return;
    }
    setIsSubmitting(true);
    const { ok, body } = await postJson(API_ROUTE_PATHS.PASSWORD_RESET, tokenHash ? { tokenHash, password } : { password });
    if (body.linkUsed) setTokenHash(null);
    if (!ok) {
      setIsSubmitting(false);
      if (body.code === PASSWORD_RESET_ERROR_CODES.INVALID_LINK) setLinkInvalid(true);
      setError(t(errorTextKey(body.code)));
      return;
    }
    // Logged in by the backend: read the session from the new cookies, as /login does.
    const session = await restoreSession();
    clearRoleCache();
    clearAccountCache();
    setIsSubmitting(false);
    setUser(session?.user ?? body.session?.user ?? null);
    setPassword('');
    goTo('done');
  }

  async function handleContinue() {
    setIsSubmitting(true);
    setLocation(user ? await postAuthRoute(user) : APP_ROUTES.LOGIN);
  }

  const footer = (
    <p>
      {t('resetPassword.rememberedIt')}{' '}
      <Link href={APP_ROUTES.LOGIN} className="font-extrabold text-shutter hover:text-pine" data-testid={RESET_TEST_IDS.LINK_GO_LOGIN}>
        {t('auth.loginCta')}
      </Link>
    </p>
  );

  const errorMessage = error ? (
    <p className="text-sm font-semibold text-terracotta" role="alert">
      {error}
    </p>
  ) : null;

  // ----- "Check your inbox" -----
  if (step === 'sent') {
    return (
      <AuthShell title={t('resetPassword.sentTitle')} subtitle={t('resetPassword.sentSubtitle')} footer={footer}>
        <div className={STATUS_CARD_CLASS} role="status" data-testid={RESET_TEST_IDS.STATUS_SENT}>
          <span className={STATUS_ICON_CLASS} aria-hidden>
            <MailCheck size={22} />
          </span>
          <p className="mt-4 text-[15px] leading-6 text-ink">
            {t('resetPassword.sentTo')} <span className="break-all font-extrabold text-pine">{sentTo}</span>
          </p>
          <p className="mt-2 text-sm leading-6 text-sage">{t('resetPassword.sentHint')}</p>
        </div>
        <button type="button" onClick={() => goTo('request')} className={TEXT_BUTTON_CLASS} data-testid={RESET_TEST_IDS.BUTTON_OTHER_EMAIL}>
          {t('resetPassword.sentWrongAddress')}
        </button>
      </AuthShell>
    );
  }

  // ----- "Password updated" -----
  if (step === 'done') {
    return (
      <AuthShell title={t('resetPassword.doneTitle')} subtitle={t('resetPassword.doneSubtitle')} footer={null}>
        <div className={STATUS_CARD_CLASS} role="status" data-testid={RESET_TEST_IDS.STATUS_DONE}>
          <span className={STATUS_ICON_CLASS} aria-hidden>
            <ShieldCheck size={22} />
          </span>
          <button
            type="button"
            onClick={handleContinue}
            disabled={isSubmitting}
            className={PRIMARY_BUTTON_CLASS}
            data-testid={RESET_TEST_IDS.BUTTON_CONTINUE}
          >
            {t('resetPassword.doneContinue')}
          </button>
        </div>
      </AuthShell>
    );
  }

  // ----- New password (opened from the emailed link) -----
  if (step === 'new') {
    return (
      <AuthShell title={t('resetPassword.newTitle')} subtitle={t('resetPassword.newSubtitle')} footer={footer}>
        <form onSubmit={handleNewPassword} className="flex flex-col gap-4" data-testid={RESET_TEST_IDS.FORM_NEW_PASSWORD}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-new-password">{t('resetPassword.newPasswordLabel')}</Label>
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage" />
              <Input
                id="reset-new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                maxLength={PASSWORD_MAX_LENGTH}
                placeholder={PASSWORD_FIELD_PLACEHOLDER}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pl-9 pr-10"
                aria-describedby="reset-new-password-hint"
                aria-invalid={error ? true : undefined}
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
            <p id="reset-new-password-hint" className="text-xs leading-5 text-sage">{t('auth.passwordHint')}</p>
          </div>

          {errorMessage}

          {linkInvalid ? (
            <button type="button" onClick={() => goTo('request')} className="h-11 w-full rounded-xl bg-mint-mist px-4 text-sm font-extrabold text-pine transition-colors hover:bg-mint-wash" data-testid={RESET_TEST_IDS.BUTTON_NEW_LINK}>
              {t('resetPassword.newLinkCta')}
            </button>
          ) : (
            <button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON_CLASS} data-testid={SHARED_TEST_IDS.BUTTON_SEARCH}>
              {isSubmitting ? t('resetPassword.saving') : t('resetPassword.newSubmit')}
            </button>
          )}
        </form>
      </AuthShell>
    );
  }

  // ----- Ask for the reset email -----
  return (
    <AuthShell title={t('resetPassword.requestTitle')} subtitle={t('resetPassword.requestSubtitle')} footer={footer}>
      <form onSubmit={handleRequest} className="flex flex-col gap-4" data-testid={RESET_TEST_IDS.FORM_REQUEST}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-email">{t('auth.emailLabel')}</Label>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage" />
            <Input
              id="reset-email"
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

        <div>
          <TurnstileWidget
            key={turnstileKey}
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
          />
        </div>

        {errorMessage}

        <button type="submit" disabled={isSubmitting || !captchaToken} className={PRIMARY_BUTTON_CLASS} data-testid={SHARED_TEST_IDS.BUTTON_SEARCH}>
          {isSubmitting ? t('resetPassword.requesting') : t('resetPassword.requestSubmit')}
        </button>
      </form>
    </AuthShell>
  );
}
