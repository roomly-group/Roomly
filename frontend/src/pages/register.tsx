import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Sparkles, Mail, Lock, User, EyeOff, Eye } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-selector';
import { Button } from '@/components/shared/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TurnstileWidget } from '@/components/shared/turnstile';
import { supabase } from '@/lib/supabase';
import { postAuthRoute } from '@/lib/auth-role';
import roomlyMark from '@assets/logo_no_background.png';

export function RegisterPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    if (!captchaToken) {
      setError(t('auth.captchaRequired'));
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
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cognome, email, password, captchaToken }),
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

      if (body.session) {
        // Email confirmation disabled in the Supabase dashboard: a session
        // + JWT was already returned. Hydrate the Supabase client so the
        // rest of the app sees a logged-in user, same as /login does.
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: body.session.access_token,
          refresh_token: body.session.refresh_token,
        });
        if (setSessionError) throw setSessionError;

        setLocation(await postAuthRoute(body.session.user));
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
    <div className="flex min-h-screen items-center justify-center bg-[#F1EFE8] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-3 flex justify-end">
          <LanguagePicker />
        </div>
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <img src={roomlyMark} alt="Roomly" className="h-14 w-14 object-contain" />
          <span className="text-2xl font-black tracking-[-0.05em] text-[#085041]">roomly</span>
        </div>

        <div className="rounded-2xl border border-[#e3ddc9] bg-[#FDFCF8] p-7 shadow-[var(--shadow-lg)] sm:p-9">
          <div className="mb-6 flex flex-col gap-1">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#E1F5EE] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#085041]">
              <Sparkles size={13} />
              {t('auth.badge')}
            </span>
            <h1 className="mt-2 text-2xl font-black text-[#2C2C2A]">{t('auth.registerTitle')}</h1>
            <p className="text-sm text-[#527067]">{t('auth.registerSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="form-register">
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
                  data-testid="input-nome"
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
                  data-testid="input-cognome"
                />
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
                  data-testid="input-email"
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
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-9 pr-10"
                  data-testid="input-password"
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-confirm-password">{t('auth.confirmPasswordLabel')}</Label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#527067]" />
                <Input
                  id="register-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="pl-9 pr-10"
                  data-testid="input-confirm-password"
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

            <div className="flex justify-center">
              <TurnstileWidget
                key={turnstileKey}
                onVerify={setCaptchaToken}
                onExpire={() => setCaptchaToken(null)}
                onError={() => setCaptchaToken(null)}
              />
            </div>

            {error ? (
              <p className="text-sm font-semibold text-red-600" role="alert">
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
                data-testid="button-search"
                className="h-12 min-w-[80px] shrink-0 rounded-xl bg-[#0F6E56] px-4 font-extrabold text-white transition-all duration-200 hover:bg-[#0c5a47] active:scale-[0.98] disabled:opacity-60"
              >
                {isSubmitting ? t('auth.registering') : t('auth.registerCta')}
              </button>   
          </form>
        </div>

        <p className="mt-6 text-center text-sm font-semibold text-[#527067]">
          {t('auth.hasAccount')}{' '}
          <Link
            href="/login"
            className="font-extrabold text-[#0F6E56] hover:text-[#085041]"
            data-testid="link-go-login"
          >
            {t('auth.loginCta')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
