import { useState, type FormEvent } from 'react';
import { clearRoleCache } from '@/lib/role-cache';
import { clearAccountCache } from '@/lib/account-cache';
import { Link, useLocation } from 'wouter';
import { EyeOff, Eye } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/shared/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { postAuthRoute } from '@/lib/auth-role';
import { APP_ROUTES, PASSWORD_FIELD_PLACEHOLDER, SHARED_TEST_IDS } from '@/lib/constants';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';
import { TurnstileWidget } from '@/components/shared/turnstile';
import { AuthLayout } from '@/components/layout/auth-layout';

// ===================== CONFIGURATION =====================

/** Stable selectors specific to the login form and its registration link. */
const LOGIN_TEST_IDS = {
  FORM_LOGIN: 'form-login',
  LINK_GO_REGISTER: 'link-go-register',
} as const;

export function LoginPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Bumped whenever we need to force the Turnstile widget to remount and
  // issue a fresh token (e.g. after a failed submit consumed the old one).
  const [turnstileKey, setTurnstileKey] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!captchaToken) {
      setError(t('auth.captchaRequired'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Call our login endpoint which verifies with Supabase and sets HTTP-only cookie.
      // captchaToken is the Turnstile response token: the backend forwards it to
      // supabase.auth.signInWithPassword({ options: { captchaToken } }), and Supabase
      // verifies it server-side against our Turnstile secret key - same protection
      // register already has, now covering login too.
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, captchaToken }),
        credentials: 'include', // Important: send cookies with request
      });

      if (!response.ok) {
        const errorData = await response.json();
        // The token is single-use and short-lived; if the request failed for any
        // reason it's already been consumed (or may now be stale), so clear it and
        // make the widget re-render rather than let the user retry with a dead token.
        setCaptchaToken(null);
        setTurnstileKey((key) => key + 1);
        throw new Error(errorData.error || 'Login failed');
      }

      // Get user data from response (no longer contains tokens for security)
      const { user } = await response.json();

      // Verify the session via cookies to update Supabase client
      const verifyResponse = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.VERIFY}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to verify session after login');
      }

      const { session } = await verifyResponse.json();

      // Set the session in Supabase client for immediate use (for frontend auth checks)
      // This is only kept in memory, not persisted to localStorage
      await supabase.auth.setSession(session);
      clearRoleCache();
      clearAccountCache();

      setLocation(await postAuthRoute(user));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      lede={t('auth.loginSubtitle')}
      footer={
        <p>
          {t('auth.noAccount')}{' '}
          <Link
            href={APP_ROUTES.REGISTER}
            className="font-extrabold text-shutter underline decoration-shutter/40 underline-offset-4 hover:decoration-2 hover:decoration-shutter"
            data-testid={LOGIN_TEST_IDS.LINK_GO_REGISTER}
          >
            {t('auth.registerCta')}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" data-testid={LOGIN_TEST_IDS.FORM_LOGIN}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-email">{t('auth.emailLabel')}</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            data-testid={SHARED_TEST_IDS.INPUT_EMAIL}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="login-password">{t('auth.passwordLabel')}</Label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              minLength={8}
              placeholder={PASSWORD_FIELD_PLACEHOLDER}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-12"
              data-testid={SHARED_TEST_IDS.INPUT_PASSWORD}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-control text-sage transition-colors hover:text-pine"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPassword ? (
                <Eye size={18} className="pointer-events-none" />
              ) : (
                <EyeOff size={18} className="pointer-events-none" />
              )}
            </button>
          </div>
        </div>

        <TurnstileWidget
          key={turnstileKey}
          onVerify={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
          onError={() => setCaptchaToken(null)}
        />

        {error ? (
          <p className="text-sm font-bold text-terracotta" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="amber"
          title={t('waitlist.ctaLogin')}
          data-testid={SHARED_TEST_IDS.BUTTON_SEARCH}
          disabled={isSubmitting || !captchaToken}
          className="h-12 w-full text-base"
        >
          {isSubmitting ? t('auth.loggingIn') : t('waitlist.ctaLogin')}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
