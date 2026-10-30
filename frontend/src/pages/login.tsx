import { useState, type FormEvent } from 'react';
import { clearRoleCache } from '@/lib/role-cache';
import { clearAccountCache } from '@/lib/account-cache';
import { Link, useLocation } from 'wouter';
import { Mail, Lock, EyeOff, Eye } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { postAuthRoute } from '@/lib/auth-role';
import { APP_ROUTES, PASSWORD_FIELD_PLACEHOLDER, SHARED_TEST_IDS } from '@/lib/constants';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';
import { AuthShell } from '@/components/layout/auth-shell';
import { TurnstileWidget } from '@/components/shared/turnstile';
import { OAuthButtons } from '@/components/shared/oauth-buttons';

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
    <AuthShell
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <p>
          {t('auth.noAccount')}{' '}
          <Link
            href={APP_ROUTES.REGISTER}
            className="font-extrabold text-[#0F6E56] hover:text-[#085041]"
            data-testid={LOGIN_TEST_IDS.LINK_GO_REGISTER}
          >
            {t('auth.registerCta')}
          </Link>
        </p>
      }
    >
      <OAuthButtons />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid={LOGIN_TEST_IDS.FORM_LOGIN}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">{t('auth.emailLabel')}</Label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#527067]" />
                <Input
                  id="login-email"
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
              <Label htmlFor="login-password">{t('auth.passwordLabel')}</Label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#527067]" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  minLength={8}
                  placeholder={PASSWORD_FIELD_PLACEHOLDER}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-9 pr-10"
                  data-testid={SHARED_TEST_IDS.INPUT_PASSWORD}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#527067] hover:text-[#085041] transition-colors"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? (
                    <Eye size={16} className="pointer-events-none" />
                  ) : (
                    <EyeOff size={16} className="pointer-events-none" />
                  )}
                </button>
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

            {error ? (
              <p className="text-sm font-semibold text-terracotta" role="alert">
                {error}
              </p>
            ) : null}

            <button
                type="submit"
                                data-testid={SHARED_TEST_IDS.BUTTON_SEARCH}
                disabled={isSubmitting || !captchaToken}
                className="mt-2 h-12 w-full rounded-[10px] bg-shutter px-4 font-extrabold text-mint-mist transition-colors hover:bg-pine disabled:opacity-50"
              >
                {isSubmitting ? t('auth.loggingIn') : t('waitlist.ctaLogin')}
              </button>
          </form>
    </AuthShell>
  );
}

export default LoginPage;
