import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, Instagram, Linkedin, Mail, Music2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Navbar } from '@/components/layout/navbar';
import { SiteFooter } from '@/components/layout/site-footer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SOCIAL_PROFILE_URLS } from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Contact email address displayed and linked by the contact page. */
const CONTACT_EMAIL_ADDRESS = 'hello@roomly.it' as const;
/** Mail link destination for the contact email address. */
const CONTACT_EMAIL_HREF = 'mailto:hello@roomly.it' as const;
/** Waitlist FAQ entries repeated on the contact page. */
const FAQ_KEYS = [1, 2, 3, 4, 5] as const;

export function ContattiPage() {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('student');
  const [message, setMessage] = useState('');

  const topics = [
    { value: 'student', label: t('contatti.topicStudent') },
    { value: 'owner', label: t('contatti.topicOwner') },
    { value: 'other', label: t('contatti.topicOther') },
  ];
  const socials = [
    { icon: Instagram, title: t('contatti.instagramTitle'), text: t('contatti.instagramText'), label: '@roomlygroup', href: SOCIAL_PROFILE_URLS.INSTAGRAM },
    { icon: Music2, title: t('contatti.tiktokTitle'), text: t('contatti.tiktokText'), label: '@roomlygroup', href: SOCIAL_PROFILE_URLS.TIKTOK },
    { icon: Linkedin, title: t('contatti.linkedinTitle'), text: t('contatti.linkedinText'), label: t('contatti.linkedinCta'), href: SOCIAL_PROFILE_URLS.LINKEDIN },
  ];

  // No backend endpoint: the form composes an email in the visitor's own mail app.
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const subject = `Roomly · ${topics.find((item) => item.value === topic)?.label ?? ''}`;
    const body = `${message}\n\n— ${name}`;
    window.location.href = `${CONTACT_EMAIL_HREF}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-cream text-ink">
      <header className="mx-auto flex h-20 w-full max-w-[1320px] items-center px-5 lg:px-8">
        <div className="w-full">
          <Navbar />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-5 pb-20 lg:px-8">
        {/* Hero with the main channel */}
        <section className="grid gap-10 rounded-[2rem] bg-mint-wash px-6 py-12 sm:px-12 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-16">
          <div>
            <h1 className="display-heading text-[clamp(2.5rem,6vw,4rem)] text-pine">{t('contatti.title')}</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-7 text-pine-text">{t('contatti.intro')}</p>
          </div>
          <div className="rounded-2xl bg-paper p-7 shadow-[var(--shadow-lg)] sm:p-8">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-pine text-mint-mist" aria-hidden>
              <Mail size={19} />
            </span>
            <h2 className="mt-5 text-xl font-black text-pine">{t('contatti.emailTitle')}</h2>
            <p className="mt-2 text-[15px] leading-6 text-sage">{t('contatti.emailText')}</p>
            <a
              href={CONTACT_EMAIL_HREF}
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-sun px-6 text-sm font-black text-ink transition-colors hover:bg-sun-hover"
            >
              {CONTACT_EMAIL_ADDRESS} <ArrowRight size={16} aria-hidden />
            </a>
          </div>
        </section>

        {/* Form + owners */}
        <section data-reveal className="mt-16 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <form onSubmit={send} className="rounded-2xl border border-line bg-paper p-6 sm:p-8" aria-labelledby="contact-form-title">
            <h2 id="contact-form-title" className="text-2xl font-black text-pine">{t('contatti.formTitle')}</h2>
            <p className="mt-2 text-[15px] leading-6 text-sage">{t('contatti.formText')}</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="contact-name">{t('contatti.formName')}</Label>
                <Input id="contact-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="contact-topic">{t('contatti.formTopic')}</Label>
                <select
                  id="contact-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  className="h-12 w-full rounded-[10px] border border-field bg-paper px-3 text-base text-ink focus-visible:border-shutter focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mint-wash/40"
                >
                  {topics.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="contact-message">{t('contatti.formMessage')}</Label>
                <textarea
                  id="contact-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={5}
                  required
                  className="w-full resize-y rounded-[10px] border border-field bg-paper px-3.5 py-3 text-base text-ink focus-visible:border-shutter focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mint-wash/40"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-shutter px-6 text-sm font-black text-mint-mist transition-colors hover:bg-pine"
            >
              <Mail size={16} aria-hidden /> {t('contatti.formSend')}
            </button>
          </form>

          <aside className="flex flex-col justify-between rounded-2xl bg-pine p-6 text-mint-mist sm:p-8">
            <div>
              <h2 className="text-2xl font-black">{t('contatti.ownerTitle')}</h2>
              <p className="mt-3 text-[15px] leading-7 text-mint-wash">{t('contatti.ownerText')}</p>
              <ul className="mt-8 space-y-5 border-t border-mint-mist/15 pt-6">
                {[
                  { title: t('home.trustBoxTitle'), text: t('home.trustBoxText') },
                  { title: t('home.trustTitle'), text: t('home.trustText') },
                  { title: t('home.ownersHeadline'), text: t('home.ownersText') },
                ].map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-mist text-pine" aria-hidden>
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span>
                      <span className="block font-extrabold">{item.title}</span>
                      <span className="mt-0.5 block text-sm leading-6 text-mint-wash">{item.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={`${CONTACT_EMAIL_HREF}?subject=${encodeURIComponent(`Roomly · ${t('contatti.topicOwner')}`)}`}
              className="mt-8 inline-flex min-h-12 w-fit items-center gap-2 rounded-xl bg-mint-mist px-6 text-sm font-black text-pine transition-colors hover:bg-mint-wash"
            >
              {t('contatti.topicOwner')} <ArrowRight size={16} aria-hidden />
            </a>
          </aside>
        </section>

        {/* Social */}
        <section data-reveal className="mt-16" aria-labelledby="contact-social">
          <h2 id="contact-social" className="display-heading text-[clamp(1.75rem,3.5vw,2.5rem)] text-pine">
            {t('contatti.socialTitle')}
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {socials.map((social, index) => (
              <li key={social.title} data-reveal style={{ '--reveal-delay': `${index * 120}ms` } as React.CSSProperties}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full flex-col rounded-2xl border border-line bg-paper p-6 transition-shadow hover:shadow-[var(--shadow-md)]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-mint-mist text-pine" aria-hidden>
                    <social.icon size={18} />
                  </span>
                  <h3 className="mt-5 text-lg font-black text-pine">{social.title}</h3>
                  <p className="mt-1 flex-1 text-sm leading-6 text-sage">{social.text}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-shutter">
                    {social.label} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section data-reveal className="mx-auto mt-16 max-w-3xl" aria-labelledby="contact-faq">
          <h2 id="contact-faq" className="display-heading text-[clamp(1.75rem,3.5vw,2.5rem)] text-pine">
            {t('contatti.faqTitle')}
          </h2>
          <Accordion type="single" collapsible className="mt-8 border-t border-line">
            {FAQ_KEYS.map((n) => (
              <AccordionItem key={n} value={`faq-${n}`} className="border-line">
                <AccordionTrigger className="min-h-14 py-4 text-left text-base font-black text-pine hover:no-underline [&>svg]:text-shutter">
                  {t(`waitlist.faqQuestion${n}`)}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-[15px] leading-7 text-sage">{t(`waitlist.faqAnswer${n}`)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
