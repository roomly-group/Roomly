import { useState, useEffect } from 'react';
import { Check, Bell, KeyRound } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Navbar } from '@/components/layout/navbar';
import { Skeleton } from '@/components/ui/skeleton';

export function WaitlistConfirmedPage() {
  const { t } = useLanguage();

  const [position, setPosition] = useState<number | null>(null);
  const [positionLoading, setPositionLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchPosition() {
      try {
        const response = await fetch('/api/waitlist/me', {
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

    fetchPosition();
  }, []);

  return (
    <div className="min-h-screen bg-[#F1EFE8]">
      <div className="mx-auto max-w-[1040px] px-6 py-6">
        <Navbar />

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
            <div className="flex justify-center text-[56px] font-black leading-none text-[#085041]">
              {positionLoading ? (
                <Skeleton className="h-[56px] w-24" />
              ) : (
                position ?? '--'
              )}
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
