import { StaticPage } from '@/components/layout/static-page';
import { useLanguage } from '@/lib/i18n';
import { SOCIAL_PROFILE_URLS } from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Contact email address displayed and linked by the contact page. */
const CONTACT_EMAIL_ADDRESS = 'hello@roomly.it' as const;
/** Mail link destination for the contact email address. */
const CONTACT_EMAIL_HREF = 'mailto:hello@roomly.it' as const;

export function ContattiPage() {
  const { t } = useLanguage();

  const channels = [
    { title: t('contatti.emailTitle'), text: t('contatti.emailText'), label: CONTACT_EMAIL_ADDRESS, href: CONTACT_EMAIL_HREF },
    { title: t('contatti.instagramTitle'), text: t('contatti.instagramText'), label: '@roomlygroup', href: SOCIAL_PROFILE_URLS.INSTAGRAM },
    { title: t('contatti.tiktokTitle'), text: t('contatti.tiktokText'), label: '@roomlygroup', href: SOCIAL_PROFILE_URLS.TIKTOK },
    { title: t('contatti.linkedinTitle'), text: t('contatti.linkedinText'), label: t('contatti.linkedinCta'), href: SOCIAL_PROFILE_URLS.LINKEDIN },
  ];

  return (
    <StaticPage
      title={t('contatti.title')}
      intro={t('contatti.intro')}
      aside={
        <section aria-labelledby="contact-owners" className="border-t-[3px] border-pine pt-4">
          <h2 id="contact-owners" className="text-[19px] font-black text-pine">
            {t('contatti.ownerTitle')}
          </h2>
          <p className="mt-2 text-base leading-7 text-ink">{t('contatti.ownerText')}</p>
        </section>
      }
    >
      <section aria-labelledby="contact-channels">
        <h2 id="contact-channels" className="sr-only">
          {t('contatti.title')}
        </h2>
        <ul className="border-t border-line">
          {channels.map((channel) => (
            <li key={channel.title} className="grid gap-x-6 gap-y-1 border-b border-line py-5 sm:grid-cols-[1fr_auto] sm:items-baseline">
              <div>
                <h3 className="text-[17px] font-extrabold text-pine">{channel.title}</h3>
                <p className="mt-1 text-base leading-7 text-ink">{channel.text}</p>
              </div>
              <a
                href={channel.href}
                target={channel.href.startsWith('http') ? '_blank' : undefined}
                rel={channel.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex min-h-11 items-center text-[15px] font-extrabold text-shutter underline decoration-shutter/40 underline-offset-4 hover:decoration-2 hover:decoration-shutter"
              >
                {channel.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

    </StaticPage>
  );
}

export default ContattiPage;
