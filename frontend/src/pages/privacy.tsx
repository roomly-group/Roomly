import { StaticPage } from '@/components/layout/static-page';
import { useLanguage } from '@/lib/i18n';

export function PrivacyPage() {
  const { t } = useLanguage();

  return (
    <StaticPage
      eyebrow={t('footer.column.legal')}
      title={t('footer.link.privacy')}
      intro={t('privacy.intro')}
    >
      <LegalSection title={t('privacy.section1Title')}>{t('privacy.section1Text')}</LegalSection>
      <LegalSection title={t('privacy.section2Title')}>{t('privacy.section2Text')}</LegalSection>
      <LegalSection title={t('privacy.section3Title')}>{t('privacy.section3Text')}</LegalSection>
      <LegalSection title={t('privacy.section4Title')}>{t('privacy.section4Text')}</LegalSection>
      <LegalSection title={t('privacy.section5Title')}>{t('privacy.section5Text')}</LegalSection>
      <LegalSection title={t('privacy.section6Title')}>{t('privacy.section6Text')}</LegalSection>
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

export default PrivacyPage;
