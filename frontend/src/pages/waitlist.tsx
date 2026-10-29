import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowRight,
  Check,
  Clock3,
  GraduationCap,
  KeyRound,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { SiteFooter } from '@/components/layout/site-footer';
import { Navbar } from '@/components/layout/navbar';
import { HeroCards } from '@/components/shared/hero-cards';
import { ScrollWords } from '@/components/shared/scroll-words';
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
/** Price shown on the labelled example card in the hero (EUR per month). */
const EXAMPLE_PRICE_EUR = 450 as const;
/** Distance shown on the labelled example card in the hero (km). */
const EXAMPLE_DISTANCE_KM = 0.8 as const;
/** Stable selectors for the waitlist page. */
const WAITLIST_TEST_IDS = {
  LINK_LOGIN: 'link-waitlist-login',
  LINK_REGISTER_FINAL: 'link-waitlist-register-final',
  TEXT_SOCIAL_PROOF: 'text-waitlist-count',
} as const;

const FAQ_KEYS = [1, 2, 3, 4, 5] as const;
const SECTION_TITLE_CLASS = 'display-heading text-[clamp(2rem,4.4vw,2.75rem)] text-pine';

/** The mechanism in one glance: a labelled example card with distance to the university leading. */

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
    { icon: UserPlus, title: t('waitlist.step1Title'), text: t('waitlist.step1Text') },
    { icon: Search, title: t('waitlist.step2Title'), text: t('waitlist.step2Text') },
    { icon: KeyRound, title: t('waitlist.step3Title'), text: t('waitlist.step3Text') },
  ];
  const reasons = [
    { icon: ShieldCheck, title: t('waitlist.whyRoomlyTransparencyTitle'), text: t('waitlist.whyRoomlyTransparencyText') },
    { icon: Search, title: t('waitlist.whyRoomlyEverythingTitle'), text: t('waitlist.whyRoomlyEverythingText') },
    { icon: GraduationCap, title: t('waitlist.whyRoomlyStudentsTitle'), text: t('waitlist.whyRoomlyStudentsText') },
  ];
  const needs = [
    { icon: MapPin, text: t('waitlist.point1') },
    { icon: Wallet, text: t('waitlist.point2') },
    { icon: Clock3, text: t('waitlist.point3') },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-cream text-ink">
      <header className="mx-auto flex h-20 w-full max-w-[1320px] items-center px-5 lg:px-8">
        <div className="w-full">
          <Navbar />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-5 pb-16 lg:px-8">
        {/* Hero: the promise, one amber action, and the mechanism shown on a labelled example. */}
        <section className="relative overflow-hidden rounded-[2rem] bg-mint-wash px-5 py-10 sm:px-10 sm:py-16 lg:px-16 lg:py-20">

          <div className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
            <div className="page-enter">
              {/* Slightly smaller on phones so the longest translations (it, fr) stay on one line at 360px. */}
              <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-mint-mist px-3 py-1.5 text-[11px] font-extrabold text-pine sm:px-3.5 sm:text-xs">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-shutter" aria-hidden /> {t('waitlist.badge')}
              </p>
              <h1 className="display-heading mt-5 max-w-xl text-[clamp(3rem,8vw,4.5rem)] text-pine sm:mt-6">{t('waitlist.title')}</h1>
              <p className="mt-4 max-w-lg text-[17px] leading-7 text-pine-text sm:mt-5">{t('waitlist.subtitle')}</p>

              <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
                <Link
                  href={APP_ROUTES.REGISTER}
                  className="inline-flex h-[52px] items-center justify-center gap-2 rounded-xl bg-sun px-7 text-[15px] font-black text-ink transition-[background-color,transform] duration-200 hover:bg-sun-hover active:scale-[0.98]"
                  data-testid={SHARED_TEST_IDS.BUTTON_SEARCH}
                >
                  {t('waitlist.ctaRegister')} <ArrowRight size={17} aria-hidden />
                </Link>
                <Link
                  href={APP_ROUTES.LOGIN}
                  className="inline-flex h-[52px] items-center justify-center rounded-xl border border-pine/20 px-7 text-[15px] font-black text-pine transition-colors hover:bg-mint-mist"
                  data-testid={WAITLIST_TEST_IDS.LINK_LOGIN}
                >
                  {t('waitlist.ctaLogin')}
                </Link>
              </div>
              <p className="mt-4 text-sm text-pine-text">{t('waitlist.ctaNote')}</p>

              {showCount && (
                <p className="mt-6 text-sm font-bold text-pine" data-testid={WAITLIST_TEST_IDS.TEXT_SOCIAL_PROOF}>
                  <span className="text-lg font-black tabular-nums">{waitlistCount.toLocaleString()}</span>{' '}
                  {t('waitlist.socialProofSuffix')}
                </p>
              )}
            </div>

            <div className="hidden justify-center lg:flex" aria-hidden>
              <div data-scroll-tilt>
                <HeroCards />
              </div>
            </div>
          </div>
        </section>

        {/* How it works: a real sequence, so the numbers carry information. */}
        <section data-reveal className="mt-14 sm:mt-20" aria-labelledby="waitlist-how">
          <h2 id="waitlist-how" className={SECTION_TITLE_CLASS}>
            {t('waitlist.howItWorksTitle')}
          </h2>
          {/* Phones: a vertical timeline (icon left, text right, joined by a line). From md: three columns joined left to right. */}
          <ol className="relative mt-8 grid gap-7 md:mt-10 md:grid-cols-3 md:gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className={`relative flex gap-4 md:block ${
                    index < steps.length - 1
                      ? 'before:absolute before:-bottom-7 before:left-6 before:top-12 before:w-px before:bg-outline md:before:hidden md:after:absolute md:after:left-16 md:after:right-0 md:after:top-6 md:after:h-px md:after:bg-outline'
                      : ''
                  }`}
                >
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pine text-mint-mist ring-8 ring-cream">
                    <Icon size={20} aria-hidden />
                  </span>
                  <div className="min-w-0 pt-1 md:pt-0">
                    <p className="text-xs font-black tabular-nums tracking-[0.15em] text-shutter md:mt-5">0{index + 1}</p>
                    <h3 className="mt-1 text-lg font-black text-pine">{step.title}</h3>
                    <p className="mt-2 max-w-sm text-[15px] leading-6 text-sage">{step.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Pine band: the two promises the product actually keeps. */}
        <section data-reveal className="on-dark relative mt-14 overflow-hidden rounded-[2rem] bg-pine px-5 py-10 text-mint-mist sm:mt-20 sm:px-10 sm:py-12 lg:px-16 lg:py-16">
          <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
            <div>
              <h2 className="display-heading mt-3 max-w-lg text-[clamp(2rem,4.4vw,2.75rem)] text-mint-mist">
                {t('waitlist.featureHighlightTitle')} <span className="text-mint-wash">{t('waitlist.featureHighlightTitleAlt')}</span>
              </h2>
              <p className="mt-5 max-w-lg text-[15px] leading-7 text-mint-wash">{t('waitlist.featureHighlightDescription')}</p>
              <ul className="mt-7 space-y-3">
                {(['waitlist.featureHighlightItem1', 'waitlist.featureHighlightItem2', 'waitlist.featureHighlightItem3'] as const).map((key) => (
                  <li key={key} className="flex items-center gap-3 text-[15px] font-bold">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint-mist text-pine" aria-hidden>
                      <Check size={15} strokeWidth={3} />
                    </span>
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-4 self-center">
              {[
                { icon: ShieldCheck, title: t('waitlist.feature1Title'), text: t('waitlist.feature1Text') },
                { icon: MessageCircle, title: t('waitlist.feature3Title'), text: t('waitlist.feature3Text') },
              ].map((feature) => {
                const Icon = feature.icon;
                // Phones: icon beside the text, so the copy gets the card's full width.
                return (
                  <div key={feature.title} className="flex gap-4 rounded-2xl bg-shutter/45 p-5 sm:block sm:p-6">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-mist text-pine" aria-hidden>
                      <Icon size={20} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-black text-mint-mist sm:mt-4">{feature.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-mint-wash">{feature.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Why Roomly, and what students away from home look for. */}
        <section data-reveal className="mt-14 grid grid-cols-1 gap-10 sm:mt-20 lg:grid-cols-[1fr_1.3fr] lg:gap-12" aria-labelledby="waitlist-why">
          <div>
            <h2 id="waitlist-why" className={SECTION_TITLE_CLASS}>
              {t('waitlist.whyRoomlyTitle')}
            </h2>
            <ScrollWords text={t('waitlist.whyRoomlyDescription')} className="mt-5 max-w-md text-[19px] font-bold leading-8 text-pine" />

            <h3 className="mt-10 text-lg font-black text-pine">{t('waitlist.previewTitle')}</h3>
            <ul className="mt-4 space-y-3">
              {needs.map((need) => {
                const Icon = need.icon;
                return (
                  <li key={need.text} className="flex items-center gap-3 text-[15px] font-bold text-ink">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint-mist text-shutter" aria-hidden>
                      <Icon size={17} />
                    </span>
                    {need.text}
                  </li>
                );
              })}
            </ul>
          </div>
          <ul className="divide-y divide-line self-start rounded-2xl border border-pine/10 bg-paper px-5 shadow-rest sm:px-8">
            {reasons.map((reason) => {
              const Icon = reason.icon;
              return (
                <li key={reason.title} data-reveal className="flex gap-4 py-5 sm:py-6">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-mist text-shutter" aria-hidden>
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3 className="text-lg font-black text-pine">{reason.title}</h3>
                    <p className="mt-1 text-[15px] leading-6 text-sage">{reason.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section data-reveal id="faq" className="mt-14 scroll-mt-8 sm:mt-20" aria-labelledby="waitlist-faq">
          <div className="mx-auto max-w-3xl">
            <h2 id="waitlist-faq" className={SECTION_TITLE_CLASS}>
              {t('waitlist.faqTitle')}
            </h2>
            <Accordion type="single" collapsible defaultValue="faq-1" className="mt-8 border-t border-line">
              {FAQ_KEYS.map((n) => (
                <AccordionItem key={n} value={`faq-${n}`} className="border-line">
                  <AccordionTrigger className="min-h-14 py-4 text-left text-base font-black text-pine hover:no-underline [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-shutter">
                    {t(`waitlist.faqQuestion${n}`)}
                  </AccordionTrigger>
                  <AccordionContent className="max-w-2xl pb-5 text-[15px] leading-7 text-sage">
                    {t(`waitlist.faqAnswer${n}`)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Close: back to the one action. */}
        <section data-reveal className="relative mt-14 overflow-hidden rounded-[2rem] bg-mint-wash px-5 py-12 text-center sm:mt-20 sm:px-10 sm:py-14">
          <div className="relative">
            <KeyRound size={28} className="mx-auto text-shutter" aria-hidden />
            <h2 className="display-heading mx-auto mt-4 max-w-xl text-[clamp(2rem,4.4vw,2.75rem)] text-pine">{t('waitlist.finalTitle')}</h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-7 text-pine-text">{t('waitlist.finalSubtitle')}</p>
            <Link
              href={APP_ROUTES.REGISTER}
              className="mt-8 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-sun px-7 text-[15px] font-black text-ink transition-[background-color,transform] duration-200 hover:bg-sun-hover active:scale-[0.98] sm:w-auto"
              data-testid={WAITLIST_TEST_IDS.LINK_REGISTER_FINAL}
            >
              {t('waitlist.ctaRegister')} <ArrowRight size={17} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default WaitlistPage;
