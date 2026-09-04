import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { Check, LogOut, Mail, Bell, KeyRound, UserRound, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-selector';
import { Avatar } from '@/components/layout/app-shell';
import roomlyMark from '@assets/logo_no_background.png';

export function WaitlistConfirmedPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const [position, setPosition] = useState<number | null>(null);
  const [positionLoading, setPositionLoading] = useState<boolean>(true);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchPosition() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        const accessToken = session?.access_token;

        const response = await fetch('/api/waitlist/me', {
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
          },
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setPosition(data.position);
        } else {
          setPosition(107);
        }
      } catch (error) {
        console.error('Failed to fetch waitlist position:', error);
        setPosition(107);
      } finally {
        setPositionLoading(false);
      }
    }

    async function fetchUser() {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
    }

    fetchPosition();
    fetchUser();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.sessionStorage.removeItem('sb-session');
    setLocation('/');
  }

  const displayName = userEmail ? userEmail.split('@')[0] : t('waitlistConfirmed.defaultDisplayName');

  return (
    <div className="min-h-screen bg-[#F1EFE8]">
      <div className="mx-auto max-w-[1040px] px-6 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src={roomlyMark} alt="Roomly" className="h-8 w-8 object-contain" />
            <span className="text-lg font-black tracking-[-0.03em] text-[#085041]">roomly</span>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-full border border-[#0850411f] bg-white py-1 pl-1 pr-3 transition-colors hover:border-[#08504140]"
              data-testid="button-profile-menu"
              aria-expanded={menuOpen}
            >
              <Avatar name={displayName} size="sm" />
              <span className="hidden text-sm font-extrabold text-[#085041] sm:block">
                {displayName}
              </span>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-[#0850411a] bg-white p-4 shadow-[0_16px_40px_rgba(8,80,65,0.14)]"
                data-testid="panel-profile-info"
              >
                <div className="flex items-center gap-3 border-b border-[#0850411a] pb-4">
                  <Avatar name={displayName} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[#085041]">{displayName}</p>
                    <p className="flex items-center gap-1 truncate text-xs font-semibold text-[#527067]">
                      <Mail size={12} className="shrink-0" />
                      {userEmail ?? t('waitlistConfirmed.emailUnavailable')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-[#E1F5EE] px-3 py-2.5">
                    <span className="text-xs font-bold text-[#527067]">{t('waitlistConfirmed.menuPositionLabel')}</span>
                    <span className="text-sm font-black text-[#085041]">
                      {positionLoading ? '…' : `#${position ?? '--'}`}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#527067]">{t('settings.language')}</span>
                  <LanguagePicker />
                </div>

                <Link
                  href="/profile"
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#085041] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0F6E56]"
                  data-testid="link-full-profile"
                >
                  <UserRound size={15} />
                  {t('waitlistConfirmed.fullProfileLink')}
                  <ArrowRight size={14} />
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#0850411a] py-2.5 text-sm font-bold text-[#527067] transition-colors hover:border-[#08504140] hover:text-[#085041]"
                  data-testid="button-logout"
                >
                  <LogOut size={15} />
                  {t('waitlistConfirmed.logout')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Position hero */}
        <section className="relative mt-2 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#E1F5EE] via-[#9FE1CB] to-[#7FD1AE] px-7 py-14 text-center shadow-[0_20px_50px_rgba(8,80,65,0.12)] sm:px-12">
          <div className="pointer-events-none absolute -right-28 -top-32 h-[280px] w-[280px] rounded-full border border-[#08504124]" />
          <div className="pointer-events-none absolute -bottom-24 -left-20 h-[200px] w-[200px] rounded-full bg-white/20" />

          <div className="relative z-10 mx-auto inline-flex items-center gap-2 rounded-full border border-[#08504129] bg-[#08504114] px-4 py-1.5 text-xs font-extrabold text-[#085041]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#EF9F27]" />
            {t('waitlistConfirmed.badge')}
          </div>

          <h1 className="relative z-10 mx-auto mt-6 max-w-md text-[32px] font-black leading-tight text-[#085041] sm:text-[38px]">
            {t('waitlistConfirmed.title')}
          </h1>
          <p className="relative z-10 mx-auto mt-3 max-w-[480px] text-[15px] leading-relaxed text-[#085041]/70 sm:text-[16px]">
            {t('waitlistConfirmed.subtitle')}
          </p>

          <div className="relative z-10 mx-auto mt-8 inline-block rounded-2xl border border-[#0850411f] bg-white px-10 py-6 shadow-[0_10px_26px_rgba(8,80,65,0.08)]">
            <div className="text-xs font-bold uppercase tracking-wide text-[#527067]">
              {t('waitlistConfirmed.positionLabel')}
            </div>
            <div className="text-[56px] font-black leading-none text-[#085041]">
              {positionLoading ? t('waitlistConfirmed.positionLoading') : position ?? '--'}
            </div>
          </div>
        </section>

        {/* What happens next */}
        <section className="py-12">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#0F6E56]">
              {t('waitlistConfirmed.whatNextEyebrow')}
            </p>
            <h2 className="text-[26px] font-black text-[#2C2C2A] sm:text-[30px]">
              {t('waitlistConfirmed.whatNextTitle')}
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <MiniStep
              icon={<Check size={20} />}
              title={t('waitlistConfirmed.step1Title')}
              text={t('waitlistConfirmed.step1Text')}
            />
            <MiniStep
              icon={<Bell size={20} />}
              title={t('waitlistConfirmed.step2Title')}
              text={t('waitlistConfirmed.step2Text')}
            />
            <MiniStep
              icon={<KeyRound size={20} />}
              title={t('waitlistConfirmed.step3Title')}
              text={t('waitlistConfirmed.step3Text')}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function MiniStep({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#0850411a] bg-white p-6 transition-shadow hover:shadow-[0_10px_26px_rgba(8,80,65,0.08)]">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E1F5EE] text-[#085041]">
        {icon}
      </div>
      <h3 className="mb-1.5 text-base font-black text-[#2C2C2A]">{title}</h3>
      <p className="text-sm leading-relaxed text-[#527067]">{text}</p>
    </div>
  );
}

export default WaitlistConfirmedPage;
