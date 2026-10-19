import { Check, Bell, KeyRound } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Navbar } from '@/components/layout/navbar';
import { SiteFooter } from '@/components/layout/site-footer';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccount } from '@/lib/account-cache';

export function WaitlistConfirmedPage() {
  const { t } = useLanguage();

  // Same shared /api/me cache as the navbar (posizione = /api/waitlist/me position).
  // An unknown position shows a dash, never a stand-in number.
  const { account, loading: positionLoading } = useAccount();
  const position = account?.posizione ?? null;

  const steps = [
    { icon: Check, title: t('waitlistConfirmed.step1Title'), text: t('waitlistConfirmed.step1Text') },
    { icon: Bell, title: t('waitlistConfirmed.step2Title'), text: t('waitlistConfirmed.step2Text') },
    { icon: KeyRound, title: t('waitlistConfirmed.step3Title'), text: t('waitlistConfirmed.step3Text') },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-cream text-ink">
      <header className="mx-auto flex h-20 w-full max-w-[1320px] items-center px-5 lg:px-8">
        <div className="w-full">
          <Navbar />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-16 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-mint-wash px-6 py-12 sm:px-12 sm:py-16">

          <div className="relative grid items-center gap-10 md:grid-cols-[1.4fr_1fr]">
            <div className="page-enter">
              <p className="inline-flex items-center gap-2 rounded-full bg-mint-mist px-3.5 py-1.5 text-xs font-extrabold text-pine">
                <span className="h-1.5 w-1.5 rounded-full bg-shutter" aria-hidden />
                {t('waitlistConfirmed.badge')}
              </p>
              <h1 className="display-heading mt-6 max-w-md text-[clamp(2.5rem,6vw,3.5rem)] text-pine">{t('waitlistConfirmed.title')}</h1>
              <p className="mt-4 max-w-md text-[16px] leading-7 text-pine-text">{t('waitlistConfirmed.subtitle')}</p>
            </div>

            <div className="justify-self-start rounded-2xl border border-pine/10 bg-paper px-10 py-7 shadow-float md:justify-self-center">
              <p className="text-sm font-bold text-sage">{t('waitlistConfirmed.positionLabel')}</p>
              <p className="mt-2 text-[64px] font-black leading-none tracking-[-0.05em] tabular-nums text-pine">
                {positionLoading ? <Skeleton className="h-16 w-24" /> : position !== null ? `#${position}` : '—'}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="confirmed-next">
          <h2 id="confirmed-next" className="display-heading text-[clamp(2rem,4.4vw,2.75rem)] text-pine">
            {t('waitlistConfirmed.whatNextTitle')}
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="border-t border-line pt-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-mint-mist text-shutter" aria-hidden>
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-4 text-lg font-black text-pine">{step.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-6 text-sage">{step.text}</p>
                </li>
              );
            })}
          </ol>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default WaitlistConfirmedPage;
