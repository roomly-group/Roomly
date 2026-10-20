import { useState, type FormEvent } from 'react';
import { clearRoleCache } from '@/lib/role-cache';
import { clearAccountCache } from '@/lib/account-cache';
import { Link, useLocation } from 'wouter';
import { Sparkles, Mail, Lock, User, EyeOff, Eye } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-selector';
import { Button } from '@/components/shared/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/layout/auth-shell';
import { TurnstileWidget } from '@/components/shared/turnstile';
import { supabase } from '@/lib/supabase';
import { postAuthRoute } from '@/lib/auth-role';
import { APP_ROUTES, PASSWORD_FIELD_PLACEHOLDER, SHARED_TEST_IDS } from '@/lib/constants';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';
import roomlyMark from '@assets/logo_no_background.png';

// ===================== CONFIGURATION =====================

/** Regular expression enforcing the registration password character rules. */
const PASSWORD_REQUIREMENTS_PATTERN = `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+=[\\]{};':"\\\\|<>?,./\`~-])[A-Za-z\\d!@#$%^&*()_+=[\\]{};':"\\\\|<>?,./\`~-]{8,}` as const;
/** Stable selectors specific to the registration form. */
const REGISTER_TEST_IDS = {
  FORM_REGISTER: 'form-register',
  INPUT_FIRST_NAME: 'input-nome',
  INPUT_LAST_NAME: 'input-cognome',
  INPUT_CONFIRM_PASSWORD: 'input-confirm-password',
  INPUT_BIRTH_DATE: 'input-data-nascita',
  LINK_GO_LOGIN: 'link-go-login',
} as const;

export function RegisterPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dataNascita, setDataNascita] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Bumped whenever we need to force the Turnstile widget to remount and
  // issue a fresh token (e.g. after a failed submit consumed the old one).
  const [turnstileKey, setTurnstileKey] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    // Date of birth validation
    if (!dataNascita) {
      setError(t('auth.dateOfBirthRequired'));
      return;
    }

    const birthDate = new Date(dataNascita);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      setError(t('auth.ageUnder18'));
      return;
    }

    if (!captchaToken) {
      setError(t('auth.captchaRequired'));
      return;
    }

    const passwordRegex = new RegExp(PASSWORD_REQUIREMENTS_PATTERN);
    if (!passwordRegex.test(password)) {
      setError(t('auth.passwordPattern'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Registration goes through our own backend now (POST /api/register)
      // instead of calling supabase.auth.signUp() directly from the browser.
      // That direct-from-browser call used to bypass our Express server
      // entirely, so no server-side rate limiting could ever apply to it -
      // anyone with the (public) anon key could script account creation
      // straight against Supabase. Routing it through /api/register puts it
      // behind signupLimiter (see backend/src/middleware/rateLimit.ts).
      //
      // captchaToken is the Turnstile response token: the backend forwards
      // it to supabase.auth.signUp({ options: { captchaToken } }), and
      // Supabase verifies it server-side against our Turnstile secret key.
      // This is what actually stops a script that skips the browser and
      // hits Supabase directly - the anon key alone is not enough to pass,
      // it also needs a token that only a real Turnstile challenge produces.
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.REGISTER}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cognome, email, password, dataNascita, captchaToken }),
      });
      const body = await response.json();

      if (!response.ok) {
        // The token is single-use and short-lived; if the request failed for
        // any reason it's already been consumed (or may now be stale), so
        // clear it and make the widget re-render rather than let the user
        // retry with a dead token.
        setCaptchaToken(null);
        setTurnstileKey((key) => key + 1);
        throw new Error(body.error ?? t('auth.registerError'));
      }

      if (body.user) {
        // Email confirmation disabled in the Supabase dashboard: user data
        // was returned. Verify the session via cookies to update Supabase client
        // same as /login does.
        const verifyResponse = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.VERIFY}`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!verifyResponse.ok) {
          throw new Error('Failed to verify session after registration');
        }

        const { session } = await verifyResponse.json();

        // Set the session in Supabase client for immediate use (for frontend auth checks)
        // This is only kept in memory, not persisted to localStorage
        const { error: setSessionError } = await supabase.auth.setSession(session);
        if (setSessionError) throw setSessionError;
        clearRoleCache();
        clearAccountCache();

        setLocation(await postAuthRoute(body.user));
        return;
      }

      // Email confirmation enabled: no session yet, user must confirm their inbox.
      setInfoMessage(t('auth.registerCheckEmail'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registerError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      footer={
        <p>
          {t('auth.hasAccount')}{' '}
          <Link
            href={APP_ROUTES.LOGIN}
            className="font-extrabold text-[#0F6E56] hover:text-[#085041]"
            data-testid={REGISTER_TEST_IDS.LINK_GO_LOGIN}
          >
            {t('auth.loginCta')}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid={REGISTER_TEST_IDS.FORM_REGISTER}>
            <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-nome">{t('auth.firstNameLabel')}</Label>
              <div className="relative">
                <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#527067]" />
                <Input
                  id="register-nome"
                  type="text"
                  autoComplete="given-name"
                  required
                  placeholder={t('auth.firstNamePlaceholder')}
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  className="pl-9"
                  data-testid={REGISTER_TEST_IDS.INPUT_FIRST_NAME}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-cognome">{t('auth.lastNameLabel')}</Label>
              <div className="relative">
                <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#527067]" />
                <Input
                  id="register-cognome"
                  type="text"
                  autoComplete="family-name"
                  required
                  placeholder={t('auth.lastNamePlaceholder')}
                  value={cognome}
                  onChange={(event) => setCognome(event.target.value)}
                  className="pl-9"
                  data-testid={REGISTER_TEST_IDS.INPUT_LAST_NAME}
                />
              </div>
            </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-email">{t('auth.emailLabel')}</Label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#527067]" />
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
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#527067]" />
                <Input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
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
              <p className="text-xs leading-5 text-sage">{t('auth.passwordPattern')}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-confirm-password">{t('auth.confirmPasswordLabel')}</Label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#527067]" />
                <Input
                  id="register-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder={PASSWORD_FIELD_PLACEHOLDER}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="pl-9 pr-10"
                  data-testid={REGISTER_TEST_IDS.INPUT_CONFIRM_PASSWORD}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#527067] hover:text-[#085041] transition-colors"
                  aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showConfirmPassword ? (
                    <Eye size={16} className="pointer-events-none" />
                  ) : (
                    <EyeOff size={16} className="pointer-events-none" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-data-nascita">{t('auth.dateOfBirthLabel')}</Label>
              <div className="relative">
                <Input
                  id="register-data-nascita"
                  type="date"
                  autoComplete="bday"
                  required
                  placeholder={t('auth.dateOfBirthPlaceholder')}
                  value={dataNascita}
                  onChange={(event) => setDataNascita(event.target.value)}
                  className="[&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  data-testid={REGISTER_TEST_IDS.INPUT_BIRTH_DATE}
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

            {error ? (
              <p className="text-sm font-semibold text-terracotta" role="alert">
                {error}
              </p>
            ) : null}

            {infoMessage ? (
              <p className="text-sm font-semibold text-[#0F6E56]" role="status">
                {infoMessage}
              </p>
            ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !captchaToken}
                aria-label={t('auth.registerCta')}
                title={t('auth.registerCta')}
                data-testid={SHARED_TEST_IDS.BUTTON_SEARCH}
                className="mt-2 h-12 w-full rounded-[10px] bg-shutter px-4 font-extrabold text-mint-mist transition-colors hover:bg-pine disabled:opacity-50"
              >
                {isSubmitting ? t('auth.registering') : t('auth.registerCta')}
              </button>   
          </form>
    </AuthShell>
  );
}

export default RegisterPage;
