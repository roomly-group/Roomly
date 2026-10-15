import { Mail, Instagram, Linkedin, Music2 } from 'lucide-react';
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

  return (
    <StaticPage
      eyebrow={t('footer.column.empresa')}
      title={t('contatti.title')}
      intro={t('contatti.intro')}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <ContactCard
          icon={<Mail size={20} />}
          title={t('contatti.emailTitle')}
          text={t('contatti.emailText')}
          action={{ label: CONTACT_EMAIL_ADDRESS, href: CONTACT_EMAIL_HREF }}
        />
        <ContactCard
          icon={<Instagram size={20} />}
          title={t('contatti.instagramTitle')}
          text={t('contatti.instagramText')}
          action={{ label: '@roomlygroup', href: SOCIAL_PROFILE_URLS.INSTAGRAM }}
        />
        <ContactCard
          icon={<Music2 size={20} />}
          title={t('contatti.tiktokTitle')}
          text={t('contatti.tiktokText')}
          action={{ label: '@roomlygroup', href: SOCIAL_PROFILE_URLS.TIKTOK }}
        />
        <ContactCard
          icon={<Linkedin size={20} />}
          title={t('contatti.linkedinTitle')}
          text={t('contatti.linkedinText')}
          action={{ label: t('contatti.linkedinCta'), href: SOCIAL_PROFILE_URLS.LINKEDIN }}
        />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-black text-[#2C2C2A]">{t('contatti.ownerTitle')}</h2>
        <p className="text-sm leading-relaxed text-[#527067]">
          {t('contatti.ownerText')}
        </p>
      </div>
    </StaticPage>
  );
}

function ContactCard({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action: { label: string; href: string };
}) {
  return (
    <div className="rounded-[20px] border border-[#0850411a] bg-[#F1EFE8]/60 p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E1F5EE] text-[#085041]">
        {icon}
      </div>
      <h3 className="mb-1.5 text-base font-black text-[#2C2C2A]">{title}</h3>
      <p className="mb-3 text-sm leading-relaxed text-[#527067]">{text}</p>
      <a
        href={action.href}
        target={action.href.startsWith('http') ? '_blank' : undefined}
        rel={action.href.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="text-sm font-extrabold text-[#085041] hover:text-[#0F6E56]"
      >
        {action.label} →
      </a>
    </div>
  );
}

export default ContattiPage;
