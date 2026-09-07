import { StaticPage } from '@/components/layout/static-page';
import { useLanguage } from '@/lib/i18n';

export function CookiePage() {
  const { t } = useLanguage();

  return (
    <StaticPage
      eyebrow={t('footer.column.legal')}
      title={t('footer.link.cookie')}
      intro={t('cookie.intro')}
    >
      <LegalSection title={t('cookie.section1Title')}>{t('cookie.section1Text')}</LegalSection>
      <LegalSection title={t('cookie.section2Title')}>{t('cookie.section2Text')}</LegalSection>
      <LegalSection title={t('cookie.section3Title')}>{t('cookie.section3Text')}</LegalSection>
      <LegalSection title={t('cookie.section4Title')}>{t('cookie.section4Text')}</LegalSection>
      <LegalSection title={t('cookie.section5Title')}>{t('cookie.section5Text')}</LegalSection>
    </StaticPage>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-base font-black text-[#2C2C2A]">{title}</h2>
      <p className="text-sm leading-relaxed text-[#527067]">{children}</p>
    </div>
  );
}

export default CookiePage;
