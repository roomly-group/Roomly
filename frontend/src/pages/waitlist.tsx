import { Link } from 'wouter';
import {
  Sparkle,
  ShieldCheck,
  MessageCircle,
  Search,
  UserPlus,
  KeyRound,
  MapPin,
  Wallet,
  Clock3,
  Plus,
  Check,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import roomlyMark from '@assets/logo_no_background.png';
import { SiteFooter } from '@/components/layout/site-footer';
import { Navbar } from '@/components/layout/navbar';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

const FAQ_ITEMS = [
  {
    question: 'Cos’è Roomly?',
    answer:
      'Roomly è la piattaforma che mette in contatto studenti in cerca di una stanza con proprietari che pubblicano annunci, per trovare casa in modo semplice e trasparente.',
  },
  {
    question: 'Roomly è già disponibile?',
    answer:
      'Roomly è attualmente in fase beta. Iscrivendoti alla waitlist avrai accesso in anteprima non appena apriremo nuovi posti.',
  },
  {
    question: 'Quanto costa iscriversi alla waitlist?',
    answer:
      'L’iscrizione alla waitlist è completamente gratuita e non richiede alcun impegno.',
  },
  {
    question: 'Come funziona la ricerca di una stanza?',
    answer:
      'Crei un profilo, cerchi tra gli annunci disponibili nella tua zona e contatti direttamente i proprietari tramite la messaggistica di Roomly.',
  },
  {
    question: 'Posso pubblicare un annuncio come proprietario?',
    answer:
      'Sì. Durante la beta i proprietari possono candidarsi a pubblicare i propri annunci scrivendoci dalla pagina Contatti.',
  },
];

export function WaitlistPage() {
  const { t } = useLanguage();
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    fetch('/api/waitlist/count')
      .then(response => response.json())
      .then(data => {
        setWaitlistCount(data.count);
      })
      .catch(error => {
        console.error('Failed to fetch waitlist count:', error);
        setWaitlistCount(1284);
      });
  }, []);

  useEffect(() => {
    const scrollToFaqIfNeeded = () => {
      if (window.location.hash === '#faq') {
        document
          .getElementById('faq')
          ?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    scrollToFaqIfNeeded();

    window.addEventListener('hashchange', scrollToFaqIfNeeded);

    return () =>
      window.removeEventListener('hashchange', scrollToFaqIfNeeded);
  }, []);

  return (
    <div className="min-h-screen bg-[#F1EFE8]">
      <div className="mx-auto max-w-[1040px] px-6 py-6">
        <Navbar />

        {/* =========================================================
            HERO
        ========================================================= */}
        <section className="relative mt-2 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#E1F5EE] via-[#9FE1CB] to-[#7FD1AE] px-6 py-16 text-center sm:px-10 sm:py-20">

          <div className="pointer-events-none absolute -right-28 -top-32 h-[280px] w-[280px] rounded-full border border-[#08504124]" />

          <div className="pointer-events-none absolute -bottom-20 -left-16 h-[180px] w-[180px] rounded-full bg-white/25" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative z-10 mx-auto inline-flex items-center gap-2 rounded-full border border-[#08504129] bg-[#08504114] px-4 py-1.5 text-xs font-extrabold text-[#085041]">
              <motion.span
  whileHover={{ scale: 1.3 }}
  whileTap={{ scale: 1.1 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
  className="h-1.5 w-1.5 rounded-full bg-[#EF9F27]"
/>
              {t('waitlist.badge')}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative z-10 mx-auto mt-7 flex h-[76px] w-[76px] items-center justify-center rounded-[20px] bg-white shadow-[0_14px_30px_rgba(8,80,65,0.1)]">
              <img
                src={roomlyMark}
                alt=""
                className="h-13 w-13 object-contain"
              />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="relative z-10 mx-auto mt-7 max-w-lg text-4xl font-black leading-[1.1] text-[#085041] sm:text-5xl"
          >
            {t('waitlist.title')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="relative z-10 mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-[#085041]/75"
          >
            {t('waitlist.subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="relative z-10 mt-8 flex justify-center"
          >
            <Link href="/register">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                aria-label={t('waitlist.ctaRegister')}
                title={t('waitlist.ctaRegister')}
                data-testid="button-search"
                className="h-12 min-w-[80px] shrink-0 rounded-xl bg-[#EF9F27] px-4 font-extrabold text-[#2C2C2A] transition-all duration-200 hover:bg-[#e6a53d] active:scale-[0.98]"
              >
                {t('waitlist.ctaRegister')}
              </motion.button>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="relative z-10 mt-3 text-xs text-[#085041]/60"
          >
            {t('waitlist.ctaNote')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="relative z-10 mt-6 inline-block rounded-full border border-[#08504129] bg-white/60 px-5 py-2 text-sm font-semibold text-[#085041]"
          >
            <Sparkle
              size={14}
              className="mr-1.5 inline -translate-y-px"
            />

            {waitlistCount !== null ? (
              <strong className="font-black">
                {waitlistCount.toLocaleString()}
              </strong>
            ) : (
              <Skeleton className="inline-block h-4 w-10 align-middle" />
            )}{' '}

            {t('waitlist.socialProofSuffix')}
          </motion.div>
        </section>

        {/* =========================================================
            STATS
        ========================================================= */}
        <section className="grid grid-cols-2 gap-4 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Stat
              value={
                waitlistCount !== null
                  ? waitlistCount.toLocaleString()
                  : null
              }
              label={t('waitlist.statPositionsLabel')}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Stat
              value="4,8/5"
              label={t('waitlist.statRatingLabel')}
            />
          </motion.div>
        </section>

        {/* =========================================================
            HOW IT WORKS
        ========================================================= */}
        <section className="py-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="mb-8 text-center">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#0F6E56]">
                {t('waitlist.howItWorksEyebrow')}
              </p>

              <h2 className="text-[28px] font-black text-[#2C2C2A] sm:text-[32px]">
                {t('waitlist.howItWorksTitle')}
              </h2>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.3 }}
              >
                <StepCard
                  icon={<UserPlus size={20} />}
                  step="1"
                  title={t('waitlist.step1Title')}
                  text={t('waitlist.step1Text')}
                />
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <StepCard
                  icon={<Search size={20} />}
                  step="2"
                  title={t('waitlist.step2Title')}
                  text={t('waitlist.step2Text')}
                />
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <StepCard
                  icon={<KeyRound size={20} />}
                  step="3"
                  title={t('waitlist.step3Title')}
                  text={t('waitlist.step3Text')}
                />
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* =========================================================
            FEATURE CARDS
        ========================================================= */}
        <section className="grid gap-5 py-14 sm:grid-cols-2">
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.3 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <FeatureCard
              icon={
                <ShieldCheck
                  size={20}
                  className="text-[#E1F5EE]"
                />
              }
              title={t('waitlist.feature1Title')}
              text={t('waitlist.feature1Text')}
            />
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.3 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <FeatureCard
              icon={
                <MessageCircle
                  size={20}
                  className="text-[#E1F5EE]"
                />
              }
              title={t('waitlist.feature3Title')}
              text={t('waitlist.feature3Text')}
            />
          </motion.div>
        </section>

        {/* =========================================================
            WHY ROOMLY
        ========================================================= */}
        <section className="py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="mb-8 text-center">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#0F6E56]">
                {t('waitlist.whyRoomly')}
              </p>

              <h2 className="text-[28px] font-black text-[#2C2C2A] sm:text-[32px]">
                {t('waitlist.whyRoomlyTitle')}
              </h2>

              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#527067]">
                {t('waitlist.whyRoomlyDescription')}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <WhyCard
                  icon={<ShieldCheck size={19} />}
                  title={t('waitlist.whyRoomlyTransparencyTitle')}
                  text={t('waitlist.whyRoomlyTransparencyText')}
                />
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <WhyCard
                  icon={<Search size={19} />}
                  title={t('waitlist.whyRoomlyEverythingTitle')}
                  text={t('waitlist.whyRoomlyEverythingText')}
                />
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <WhyCard
                  icon={<UserPlus size={19} />}
                  title={t('waitlist.whyRoomlyStudentsTitle')}
                  text={t('waitlist.whyRoomlyStudentsText')}
                />
              </motion.div>

            </div>
          </motion.div>
        </section>

        {/* =========================================================
            WHAT STUDENTS LOOK FOR
        ========================================================= */}
        <section className="py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="mb-8 text-center">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#0F6E56]">
                {t('waitlist.previewEyebrow')}
              </p>

              <h2 className="text-[28px] font-black text-[#2C2C2A] sm:text-[32px]">
                {t('waitlist.previewTitle')}
              </h2>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.3 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <MiniPoint
                  icon={<MapPin size={18} />}
                  text={t('waitlist.point1')}
                />
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.3 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <MiniPoint
                  icon={<Wallet size={18} />}
                  text={t('waitlist.point2')}
                />
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.3 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <MiniPoint
                  icon={<Clock3 size={18} />}
                  text={t('waitlist.point3')}
                />
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* =========================================================
            sta
        ========================================================= */}
        <section className="py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative overflow-hidden rounded-[28px] bg-[#085041] px-8 py-12 sm:px-12">

              <div className="pointer-events-none absolute -right-24 -top-28 h-[240px] w-[240px] rounded-full border border-white/10" />

              <div className="pointer-events-none absolute -bottom-24 -left-16 h-[190px] w-[190px] rounded-full bg-white/5" />

              <div className="relative z-10 grid gap-10 sm:grid-cols-[1.2fr_0.8fr] sm:items-center">

                <div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                  >
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-[#E1F5EE]">
                      <Sparkle size={13} />
                      {t('waitlist.featureHighlightBadge')}
                    </div>
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    className="max-w-lg text-[28px] font-black leading-tight text-white sm:text-[34px]"
                  >
                    {t('waitlist.featureHighlightTitle')}
                    <br />
                    {t('waitlist.featureHighlightTitleAlt') || ''}
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                    className="mt-4 max-w-lg text-[15px] leading-relaxed text-[#E1F5EE]/70"
                  >
                    {t('waitlist.featureHighlightDescription')}
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.6, delay: 1.0 }}
                  className="space-y-3"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, delay: 1.1 }}
                  >
                    <HighlightItem text={t('waitlist.featureHighlightItem1')} />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, delay: 1.2 }}
                  >
                    <HighlightItem text={t('waitlist.featureHighlightItem2')} />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, delay: 1.3 }}
                  >
                    <HighlightItem text={t('waitlist.featureHighlightItem3')} />
                  </motion.div>
                </motion.div>

              </div>
            </div>
          </motion.div>
        </section>

        {/* =========================================================
            FAQ
        ========================================================= */}
        <section
          id="faq"
          className="scroll-mt-8 py-10"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="mb-8 text-center">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#0F6E56]">
                Domande frequenti
              </p>

              <h2 className="text-[28px] font-black text-[#2C2C2A] sm:text-[32px]">
                Tutto quello che c'è da sapere
              </h2>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="mx-auto max-w-2xl space-y-3">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;

                return (
                  <motion.div
                    key={item.question}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <div className="overflow-hidden rounded-2xl border border-[#0850411a] bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFaq(isOpen ? null : index)
                        }
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                        whileHover={{ backgroundColor: '#f8f9fa' }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <span className="text-sm font-black text-[#2C2C2A]">
                          {item.question}
                        </span>

                        <Plus
                          size={18}
                          className={`shrink-0 text-[#085041] transition-transform duration-200 ${
                            isOpen ? 'rotate-45' : ''
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="px-5 pb-4 text-sm leading-relaxed text-[#527067]"
                        >
                          {item.answer}
                        </motion.p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </section>

        {/* =========================================================
            FINAL CTA
        ========================================================= */}
        <section className="relative my-14 overflow-hidden rounded-[28px] bg-[#085041] px-8 py-14 text-center sm:px-14">

          <div className="pointer-events-none absolute -right-28 -top-32 h-[280px] w-[280px] rounded-full border border-white/10" />

          <div className="pointer-events-none absolute -bottom-20 -left-16 h-[180px] w-[180px] rounded-full bg-white/5" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative z-10">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mx-auto max-w-md text-[28px] font-black leading-tight text-white sm:text-[32px]"
              >
                {t('waitlist.finalTitle')}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[#E1F5EE]/75"
              >
                {t('waitlist.finalSubtitle')}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="mt-7"
              >
                <Link href="/register">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    type="button"
                    className="h-12 rounded-xl bg-[#EF9F27] px-6 font-extrabold text-[#2C2C2A] transition-all duration-200 hover:bg-[#e6a53d] active:scale-[0.98]"
                  >
                    {t('waitlist.ctaRegister')}
                  </motion.button>
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}

/* =============================================================
   STAT
============================================================= */

function Stat({
  value,
  label,
}: {
  value: string | null;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-[#0850411f] bg-white px-4 py-6 text-center">
      <div className="flex items-center justify-center text-[28px] font-black text-[#085041] sm:text-[32px]">
        {value !== null ? (
          value
        ) : (
          <Skeleton className="h-7 w-16 sm:h-8" />
        )}
      </div>

      <div className="mt-1 text-xs font-semibold text-[#527067]">
        {label}
      </div>
    </div>
  );
}

/* =============================================================
   STEP CARD
============================================================= */

function StepCard({
  icon,
  step,
  title,
  text,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#0850411a] bg-white p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E1F5EE] text-[#085041]">
          {icon}
        </div>

        <span className="text-xs font-black text-[#9fb3ab]">
          {step.padStart(2, '0')}
        </span>
      </div>

      <h3 className="mb-1.5 text-base font-black text-[#2C2C2A]">
        {title}
      </h3>

      <p className="text-sm leading-relaxed text-[#527067]">
        {text}
      </p>
    </div>
  );
}

/* =============================================================
   FEATURE CARD
   DARK GREEN + HERO DECORATION
============================================================= */

function FeatureCard({
  icon,
  title,
  text,
  amber = false,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  amber?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[20px] p-7 ${
        amber
          ? 'bg-[#EF9F27] text-[#2C2C2A]'
          : 'bg-[#085041] text-[#E1F5EE]'
      }`}
    >
      {!amber && (
        <>
          <div className="pointer-events-none absolute -right-20 -top-24 h-[190px] w-[190px] rounded-full border border-white/10" />

          <div className="pointer-events-none absolute -bottom-16 -left-10 h-[130px] w-[130px] rounded-full bg-white/5" />
        </>
      )}

      <div className="relative z-10">
        <div
          className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${
            amber ? 'bg-[#2C2C2A1a]' : 'bg-white/10'
          }`}
        >
          {icon}
        </div>

        <h3
          className={`mb-2 text-lg font-black ${
            amber ? 'text-[#2C2C2A]' : 'text-white'
          }`}
        >
          {title}
        </h3>

        <p
          className={`text-sm leading-relaxed ${
            amber
              ? 'text-[#2C2C2A]/70'
              : 'text-[#E1F5EE]/75'
          }`}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

/* =============================================================
   WHY ROOMLY CARD
============================================================= */

function WhyCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="group rounded-[20px] border border-[#0850411a] bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(8,80,65,0.07)]">

      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E1F5EE] text-[#085041]">
        {icon}
      </div>

      <h3 className="mb-2 text-base font-black text-[#2C2C2A]">
        {title}
      </h3>

      <p className="text-sm leading-relaxed text-[#527067]">
        {text}
      </p>
    </div>
  );
}

/* =============================================================
   HIGHLIGHT ITEM
============================================================= */

function HighlightItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#E1F5EE] text-[#085041]">
        <Check size={15} strokeWidth={3} />
      </div>

      <span className="text-sm font-semibold text-white">
        {text}
      </span>
    </div>
  );
}

/* =============================================================
   MINI POINT
============================================================= */

function MiniPoint({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#0850411a] bg-white px-5 py-4">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#E1F5EE] text-[#085041]">
        {icon}
      </div>

      <p className="text-sm font-semibold text-[#2C2C2A]">
        {text}
      </p>
    </div>
  );
}

export default WaitlistPage;

