import { Link } from 'wouter';
import { ArrowRight, MessageCircle, Search, ShieldCheck, Sparkles, UserPlus, UsersRound } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { ScrollWords } from '@/components/shared/scroll-words';
import { RoomIllustration } from '@/components/shared/room-illustration';
import { Navbar } from '@/components/layout/navbar';
import { SiteFooter } from '@/components/layout/site-footer';
import { APP_ROUTES } from '@/lib/constants';

export function ChiSiamoPage() {
  const { t } = useLanguage();

  const steps = [
    { icon: UserPlus, title: t('waitlist.step1Title'), text: t('waitlist.step1Text') },
    { icon: Search, title: t('waitlist.step2Title'), text: t('waitlist.step2Text') },
    { icon: MessageCircle, title: t('waitlist.step3Title'), text: t('waitlist.step3Text') },
  ];
  const values = [
    { icon: UsersRound, title: t('chiSiamo.value1Title'), text: t('chiSiamo.value1Text') },
    { icon: ShieldCheck, title: t('chiSiamo.value2Title'), text: t('chiSiamo.value2Text') },
    { icon: Sparkles, title: t('chiSiamo.value3Title'), text: t('chiSiamo.value3Text') },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-cream text-ink">
      <header className="mx-auto flex h-20 w-full max-w-[1320px] items-center px-5 lg:px-8">
        <div className="w-full">
          <Navbar />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-5 pb-20 lg:px-8">
        {/* Hero */}
        <section className="grid gap-10 rounded-[2rem] bg-mint-wash px-6 py-12 sm:px-12 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-16">
          <div>
            <h1 className="display-heading text-[clamp(2.5rem,6vw,4rem)] text-pine">{t('chiSiamo.title')}</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-7 text-pine-text">{t('chiSiamo.intro')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={APP_ROUTES.REGISTER}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-sun px-6 text-sm font-black text-ink transition-colors hover:bg-sun-hover"
              >
                {t('waitlist.ctaRegister')} <ArrowRight size={16} aria-hidden />
              </Link>
              <Link
                href={APP_ROUTES.CONTACT}
                className="inline-flex min-h-12 items-center rounded-xl border border-pine/20 px-6 text-sm font-black text-pine transition-colors hover:bg-cream/50"
              >
                {t('chiSiamo.ctaContact')}
              </Link>
            </div>
          </div>
          <div data-scroll-tilt className="mx-auto w-full max-w-[420px] rounded-2xl border border-pine/10 bg-paper p-3 shadow-float">
            <RoomIllustration className="rounded-xl" />
          </div>
        </section>

        {/* Mission, lit word by word while scrolling */}
        <section className="mx-auto mt-24 max-w-4xl" aria-label={t('chiSiamo.missionTitle')}>
          <ScrollWords as="p" text={t('chiSiamo.missionText')} className="text-[clamp(1.5rem,3.2vw,2.5rem)] font-black leading-[1.25] tracking-[-0.02em] text-pine" />
        </section>

        {/* How it works */}
        <section data-reveal className="mt-20" aria-labelledby="about-how">
          <h2 id="about-how" className="display-heading text-[clamp(1.75rem,3.5vw,2.5rem)] text-pine">
            {t('chiSiamo.howTitle')}
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} data-reveal style={{ '--reveal-delay': `${index * 120}ms` } as React.CSSProperties}>
                <div className="flex items-center gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-pine text-mint-mist" aria-hidden>
                    <step.icon size={19} />
                  </span>
                  {index < steps.length - 1 && <span className="hidden h-px flex-1 bg-line md:block" aria-hidden />}
                </div>
                <p className="mt-5 text-xs font-black tabular-nums text-shutter">0{index + 1}</p>
                <h3 className="mt-1 text-lg font-black text-pine">{step.title}</h3>
                <p className="mt-2 max-w-sm text-[15px] leading-6 text-sage">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Values */}
        <section data-reveal className="mt-20 rounded-[2rem] bg-pine px-6 py-12 text-mint-mist sm:px-12 lg:py-16" aria-labelledby="about-values">
          <div>
            <h2 id="about-values" className="display-heading text-[clamp(1.75rem,3.5vw,2.5rem)] text-mint-mist">
              {t('chiSiamo.valuesTitle')}
            </h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-3">
              {values.map((value, index) => (
                <li key={value.title} data-reveal style={{ '--reveal-delay': `${index * 120}ms` } as React.CSSProperties} className="rounded-2xl bg-shutter/60 p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-mint-mist text-pine" aria-hidden>
                    <value.icon size={18} />
                  </span>
                  <h3 className="mt-5 text-lg font-black">{value.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-mint-wash">{value.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Close */}
        <section data-reveal className="mt-20 flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-paper px-6 py-10 shadow-[var(--shadow-sm)] sm:px-12 md:flex-row md:items-center">
          <h2 className="max-w-xl text-[clamp(1.5rem,3vw,2rem)] font-black leading-tight text-pine">{t('chiSiamo.ctaTitle')}</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href={APP_ROUTES.REGISTER}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-shutter px-6 text-sm font-black text-mint-mist transition-colors hover:bg-pine"
            >
              {t('waitlist.ctaRegister')} <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              href={APP_ROUTES.CONTACT}
              className="inline-flex min-h-12 items-center rounded-xl border border-outline px-6 text-sm font-black text-pine transition-colors hover:bg-mint-mist"
            >
              {t('chiSiamo.ctaContact')}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default ChiSiamoPage;
