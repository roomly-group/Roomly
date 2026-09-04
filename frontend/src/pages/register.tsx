import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Sparkles, Mail, Lock, User } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-selector';
import { Button } from '@/components/shared/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  // Defaults to true (the safer path) until the backend answers, so a slow
  // or failed request never accidentally skips email confirmation.
  const [requireEmailConfirmation, setRequireEmailConfirmation] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/config')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { requireEmailConfirmation: boolean }) => {
        if (!cancelled) setRequireEmailConfirmation(data.requireEmailConfirmation);
      })
      .catch(() => {
        // Keep the safe default (true) on failure.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      if (!requireEmailConfirmation) {
        // Debug path — see backend/src/config/security-flags.ts
        // (REQUIRE_EMAIL_CONFIRMATION = false). Creates the account already
        // confirmed via the backend's admin route, then hydrates the
        // Supabase client with the returned session.
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, cognome, email, password }),
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error ?? t('auth.registerError'));
        }

        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: body.session.access_token,
          refresh_token: body.session.refresh_token,
        });
        if (setSessionError) throw setSessionError;

        setLocation(await postAuthRoute(body.user));
        return;
      }

      // Register.tsx -> supabase.auth.signUp() -> Supabase Auth -> session + JWT
      // nome/cognome are stored as user metadata on the Supabase Auth user.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome,
            cognome,
            full_name: `${nome} ${cognome}`.trim(),
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        // Email confirmation disabled in the Supabase dashboard: a session
        // + JWT was already returned. Admins (admin = true on the utenti
        // table) go straight to the app; everyone else lands on the
        // waitlist confirmation dashboard.
        setLocation(await postAuthRoute(data.session.user));
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
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-9"
                  data-testid="input-password"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-confirm-password">{t('auth.confirmPasswordLabel')}</Label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#527067]" />
                <Input
                  id="register-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="pl-9"
                  data-testid="input-confirm-password"
                />
              </div>
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
                disabled={isSubmitting}
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
