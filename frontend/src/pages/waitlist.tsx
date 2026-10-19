import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { SiteFooter } from '@/components/layout/site-footer';
import { Navbar } from '@/components/layout/navbar';
import { CityPlan, EXAMPLE_KM } from '@/components/shared/city-plan';
import { Tratta } from '@/components/shared/tratta';
import { SectionHead } from '@/components/shared/section-head';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { APP_ROUTES, SHARED_TEST_IDS } from '@/lib/constants';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';

// ===================== CONFIGURATION =====================

/** Below this many sign-ups the count is not shown: a tiny number reads as an empty room, not as proof. */
const SOCIAL_PROOF_MIN_COUNT = 100 as const;
/** Delay before scrolling to the FAQ after an anchor navigation (ms). */
const FAQ_HASH_SCROLL_DELAY_MS = 100 as const;
/** Anchor identifying the FAQ section in the waitlist page URL. */
const WAITLIST_FAQ_HASH = '#faq' as const;
/** Browser event used to detect changes to the current URL hash. */
const HASH_CHANGE_EVENT_NAME = 'hashchange' as const;
/** Stable selectors for the waitlist page. */
const WAITLIST_TEST_IDS = {
  LINK_LOGIN: 'link-waitlist-login',
  LINK_REGISTER_FINAL: 'link-waitlist-register-final',
  TEXT_SOCIAL_PROOF: 'text-waitlist-count',
} as const;

const FAQ_KEYS = [1, 2, 3, 4, 5] as const;
const ACTION_CLASS =
  'inline-flex h-[52px] items-center justify-center gap-2 rounded-control bg-sun px-7 text-[15px] font-black text-ink transition-[background-color,transform] duration-150 hover:bg-sun-hover active:translate-y-px';

export function WaitlistPage() {
  const { t } = useLanguage();
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  // Real sign-up count only: when the endpoint fails nothing is shown, never a made-up number.
  useEffect(() => {
    fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.WAITLIST_COUNT}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (typeof data.count === 'number') setWaitlistCount(data.count);
      })
      .catch((error) => {
        console.error('Failed to fetch waitlist count:', error);
      });
  }, []);

  useEffect(() => {
    const scrollToFaqIfNeeded = () => {
      if (window.location.hash === WAITLIST_FAQ_HASH) {
        setTimeout(() => {
          document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
        }, FAQ_HASH_SCROLL_DELAY_MS);
      }
    };
    scrollToFaqIfNeeded();
    window.addEventListener(HASH_CHANGE_EVENT_NAME, scrollToFaqIfNeeded);
    return () => window.removeEventListener(HASH_CHANGE_EVENT_NAME, scrollToFaqIfNeeded);
  }, []);

  const showCount = waitlistCount !== null && waitlistCount >= SOCIAL_PROOF_MIN_COUNT;

  const steps = [
    { title: t('waitlist.step1Title'), text: t('waitlist.step1Text') },
    { title: t('waitlist.step2Title'), text: t('waitlist.step2Text') },
    { title: t('waitlist.step3Title'), text: t('waitlist.step3Text') },
  ];
  const reasons = [
    { title: t('waitlist.whyRoomlyTransparencyTitle'), text: t('waitlist.whyRoomlyTransparencyText') },
    { title: t('waitlist.whyRoomlyEverythingTitle'), text: t('waitlist.whyRoomlyEverythingText') },
    { title: t('waitlist.whyRoomlyStudentsTitle'), text: t('waitlist.whyRoomlyStudentsText') },
    { title: t('waitlist.whyRoomlyOwnerTitle'), text: t('waitlist.feature1Text') },
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

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-5 pb-24 lg:px-8">
        {/* Hero: the promise on the left, the mechanism drawn on a labelled example plan on the right. */}
        <section className="grid items-center gap-12 pt-12 lg:grid-cols-12 lg:pt-20">
          <div className="page-enter lg:col-span-6">
            <h1 className="display-heading text-[clamp(3rem,7vw,5rem)] text-pine">{t('waitlist.title')}</h1>
            <p className="mt-6 max-w-lg text-[19px] leading-[1.55] text-pine-text">{t('waitlist.subtitle')}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={APP_ROUTES.REGISTER} className={ACTION_CLASS} data-testid={SHARED_TEST_IDS.BUTTON_SEARCH}>
                {t('waitlist.ctaRegister')} <ArrowRight size={17} aria-hidden />
              </Link>
              <Link
                href={APP_ROUTES.LOGIN}
                className="inline-flex h-[52px] items-center justify-center rounded-control border border-outline px-7 text-[15px] font-extrabold text-pine transition-colors hover:border-shutter hover:bg-mint-mist"
                data-testid={WAITLIST_TEST_IDS.LINK_LOGIN}
              >
                {t('waitlist.ctaLogin')}
              </Link>
            </div>
            <p className="mt-4 text-sm text-sage">{t('waitlist.ctaNote')}</p>
            {showCount && (
              <p className="mt-8 border-t border-line pt-4 text-[15px] font-bold text-pine" data-testid={WAITLIST_TEST_IDS.TEXT_SOCIAL_PROOF}>
                <span className="text-2xl font-black tabular-nums">{waitlistCount.toLocaleString()}</span> {t('waitlist.socialProofSuffix')}
              </p>
            )}
          </div>
          <div className="lg:col-span-6">
            <CityPlan />
          </div>
        </section>

        {/* How it works: a real sequence, so the numbers carry information. */}
        <section className="mt-24" aria-labelledby="waitlist-how">
          <SectionHead id="waitlist-how" title={t('waitlist.howItWorksTitle')} className="mb-2" />
          <ol className="grid md:grid-cols-3 md:gap-10">
            {steps.map((step, index) => (
              <li key={step.title} className="border-b border-line py-6 md:border-b-0 md:pt-6">
                <span className="text-[40px] font-black leading-none tracking-[-0.04em] tabular-nums text-shutter">{index + 1}</span>
                <h3 className="mt-4 text-[17px] font-extrabold text-pine">{step.title}</h3>
                <p className="mt-1.5 max-w-sm text-base leading-7 text-ink">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      {/* The band shows the promise instead of listing it: one labelled example tratta. */}
      <section className="on-dark bg-pine text-mint-mist" aria-labelledby="waitlist-promise">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-20 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-5">
            <h2 id="waitlist-promise" className="display-heading text-[clamp(2rem,4vw,3rem)] text-mint-mist">
              {t('waitlist.featureHighlightTitle')} <span className="text-mint-wash">{t('waitlist.featureHighlightTitleAlt')}</span>
            </h2>
            <p className="mt-5 max-w-md text-[17px] leading-7 text-mint-wash">{t('waitlist.featureHighlightDescription')}</p>
          </div>
          <div className="relative rounded-sheet bg-paper px-6 pb-7 pt-12 text-ink sm:px-8 lg:col-span-6 lg:col-start-7 lg:self-center">
            <span className="absolute right-3 top-3 rounded-sheet bg-pine px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-mint-mist">
              {t('waitlist.exampleLabel')}
            </span>
            <Tratta size="lg" km={EXAMPLE_KM} university={t('waitlist.exampleFrom')} fromLabel={t('waitlist.exampleFrom')} />
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1320px] px-5 py-24 lg:px-8">
        <section className="grid gap-12 lg:grid-cols-12" aria-labelledby="waitlist-why">
          <div className="lg:col-span-5">
            <h2 id="waitlist-why" className="text-[clamp(1.75rem,3vw,2.25rem)] font-black leading-[1.05] tracking-[-0.035em] text-pine">
              {t('waitlist.whyRoomlyTitle')}
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-ink">{t('waitlist.whyRoomlyDescription')}</p>
          </div>
          <dl className="border-t border-line lg:col-span-6 lg:col-start-7">
            {reasons.map((reason) => (
              <div key={reason.title} className="border-b border-line py-6">
                <dt className="text-[19px] font-black text-pine">{reason.title}</dt>
                <dd className="mt-1.5 text-base leading-7 text-ink">{reason.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="faq" className="mt-24 scroll-mt-8" aria-labelledby="waitlist-faq">
          <SectionHead id="waitlist-faq" title={t('waitlist.faqTitle')} className="mb-2" />
          <Accordion type="single" collapsible defaultValue="faq-1" className="max-w-3xl">
            {FAQ_KEYS.map((n) => (
              <AccordionItem key={n} value={`faq-${n}`} className="border-line">
                <AccordionTrigger className="min-h-14 py-4 text-left text-[17px] font-extrabold text-pine hover:no-underline [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-shutter">
                  {t(`waitlist.faqQuestion${n}`)}
                </AccordionTrigger>
                <AccordionContent className="max-w-2xl pb-5 text-base leading-7 text-ink">
                  {t(`waitlist.faqAnswer${n}`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Close: back to the one action. */}
        <section className="mt-24 grid gap-8 border-t border-line pt-12 lg:grid-cols-12 lg:items-end" aria-labelledby="waitlist-close">
          <div className="lg:col-span-7">
            <h2 id="waitlist-close" className="display-heading text-[clamp(2.25rem,4.4vw,3.25rem)] text-pine">
              {t('waitlist.finalTitle')}
            </h2>
            <p className="mt-4 max-w-md text-[17px] leading-7 text-pine-text">{t('waitlist.finalSubtitle')}</p>
          </div>
          <div className="lg:col-span-5 lg:justify-self-end">
            <Link href={APP_ROUTES.REGISTER} className={ACTION_CLASS} data-testid={WAITLIST_TEST_IDS.LINK_REGISTER_FINAL}>
              {t('waitlist.ctaRegister')} <ArrowRight size={17} aria-hidden />
            </Link>
          </div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}

export default WaitlistPage;
