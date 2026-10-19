import { useLanguage } from '@/lib/i18n';
import { Navbar } from '@/components/layout/navbar';
import { SiteFooter } from '@/components/layout/site-footer';
import { SectionHead } from '@/components/shared/section-head';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccount } from '@/lib/account-cache';

export function WaitlistConfirmedPage() {
  const { t } = useLanguage();

  // Same shared /api/me cache as the navbar (posizione = /api/waitlist/me position).
  // An unknown position shows a dash, never a stand-in number.
  const { account, loading: positionLoading } = useAccount();
  const position = account?.posizione ?? null;

  const steps = [
    { title: t('waitlistConfirmed.step1Title'), text: t('waitlistConfirmed.step1Text') },
    { title: t('waitlistConfirmed.step2Title'), text: t('waitlistConfirmed.step2Text') },
    { title: t('waitlistConfirmed.step3Title'), text: t('waitlistConfirmed.step3Text') },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ground text-ink">
      <header className="bg-pine">
        <div className="mx-auto flex h-[72px] w-full max-w-[1320px] items-center px-5 lg:px-8">
          <div className="w-full">
            <Navbar />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-5 pb-24 pt-12 lg:px-8 lg:pt-20">
        <section className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="page-enter lg:col-span-7">
            <h1 className="display-heading text-[clamp(2.75rem,6vw,4.25rem)] text-pine">{t('waitlistConfirmed.title')}</h1>
            <p className="mt-5 max-w-lg text-[19px] leading-[1.55] text-pine-text">{t('waitlistConfirmed.subtitle')}</p>
          </div>
          <div className="border-t-[3px] border-pine pt-4 lg:col-span-4 lg:col-start-9">
            <p className="text-[15px] font-bold text-sage">{t('waitlistConfirmed.positionLabel')}</p>
            <p className="mt-1 text-[clamp(4rem,9vw,6rem)] font-black leading-none tracking-[-0.05em] tabular-nums text-pine">
              {positionLoading ? <Skeleton className="h-20 w-32" /> : position !== null ? `#${position}` : '—'}
            </p>
          </div>
        </section>

        <section className="mt-24" aria-labelledby="confirmed-next">
          <SectionHead id="confirmed-next" title={t('waitlistConfirmed.whatNextTitle')} className="mb-2" />
          <ol className="grid md:grid-cols-3 md:gap-10">
            {steps.map((step, index) => (
              <li key={step.title} className="border-b border-line py-6 md:border-b-0">
                <span className="text-[40px] font-black leading-none tracking-[-0.04em] tabular-nums text-shutter">{index + 1}</span>
                <h3 className="mt-4 text-[17px] font-extrabold text-pine">{step.title}</h3>
                <p className="mt-1.5 max-w-sm text-base leading-7 text-ink">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default WaitlistConfirmedPage;
