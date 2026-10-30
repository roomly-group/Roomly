import { useState, type FormEvent } from 'react';
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
import { supabase } from '@/lib/supabase';
import { postAuthRoute } from '@/lib/auth-role';
import { APP_ROUTES, PASSWORD_FIELD_PLACEHOLDER, SHARED_TEST_IDS } from '@/lib/constants';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';
import { trackEvent } from '@/lib/analytics';

// ===================== CONFIGURATION =====================

/** Regular expression enforcing the registration password character rules. */
const PASSWORD_REQUIREMENTS_PATTERN = `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+=[\\]{};':"\\\\|<>?,./\`~-])[A-Za-z\\d!@#$%^&*()_+=[\\]{};':"\\\\|<>?,./\`~-]{8,}` as const;
/** Stable selectors specific to the registration form. */
const REGISTER_TEST_IDS = {
  FORM_REGISTER: 'form-register',
  LINK_GO_LOGIN: 'link-go-login',
  STATUS_CHECK_EMAIL: 'status-check-email',
  BUTTON_CHANGE_EMAIL: 'button-change-email',
} as const;

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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
        body: JSON.stringify({ email, password, captchaToken }),
      });
      // An empty or non-JSON reply (backend down, proxy error) must surface as a
      // normal error message, not a JSON.parse crash.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        // The token is single-use: clear it and remount the widget so a retry gets a fresh one.
        setCaptchaToken(null);
        setTurnstileKey((key) => key + 1);
        throw new Error(body.error ?? t('auth.registerError'));
      }

      // Waitlist sign-up completed: GA4 key event (sent only if the visitor accepted analytics).
      trackEvent('generate_lead', { method: 'waitlist' });

      if (body.user) {
        // Email confirmation disabled in Supabase: the account is already
        // logged in. Restore the session from the cookies, as /login does.
        const verifyResponse = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.VERIFY}`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!verifyResponse.ok) throw new Error(t('auth.registerError'));

        const { session } = await verifyResponse.json();
        const { error: setSessionError } = await supabase.auth.setSession(session);
        if (setSessionError) throw setSessionError;
        clearRoleCache();
        clearAccountCache();

        setLocation(await postAuthRoute(body.user));
        return;
      }

      // Email confirmation enabled: the link in the email opens the onboarding.
      setSentTo(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registerError'));
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
      <OAuthButtons />

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
