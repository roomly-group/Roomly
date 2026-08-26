import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { KeyRound, Mail, Lock } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/shared/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import roomlyMark from '@assets/3-removebg-preview_1787501992159.png';

export function LoginPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Login.tsx -> supabase.auth.signInWithPassword() -> Supabase Auth -> session + JWT
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (!data.session) {
        throw new Error('No session returned by Supabase Auth.');
      }

      setLocation('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1EFE8] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <img src={roomlyMark} alt="Roomly" className="h-14 w-14 object-contain" />
          <span className="text-2xl font-black tracking-[-0.05em] text-[#085041]">roomly</span>
        </div>

        <div className="rounded-2xl border border-[#e3ddc9] bg-[#FDFCF8] p-7 shadow-[var(--shadow-lg)] sm:p-9">
          <div className="mb-6 flex flex-col gap-1">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#E1F5EE] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#085041]">
              <KeyRound size={13} />
              {t('auth.badge')}
            </span>
            <h1 className="mt-2 text-2xl font-black text-[#2C2C2A]">{t('auth.loginTitle')}</h1>
            <p className="text-sm text-[#527067]">{t('auth.loginSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="form-login">
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
                  data-testid="input-email"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">{t('auth.passwordLabel')}</Label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#527067]" />
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
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

            {error ? (
              <p className="text-sm font-semibold text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="mt-2 w-full justify-center"
              data-testid="button-login-submit"
            >
              {isSubmitting ? t('auth.loggingIn') : t('auth.loginCta')}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm font-semibold text-[#527067]">
          {t('auth.noAccount')}{' '}
          <Link
            href="/register"
            className="font-extrabold text-[#0F6E56] hover:text-[#085041]"
            data-testid="link-go-register"
          >
            {t('auth.registerCta')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
