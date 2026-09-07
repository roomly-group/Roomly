import { StaticPage } from '@/components/layout/static-page';
import { useLanguage } from '@/lib/i18n';

export function TerminiPage() {
  const { t } = useLanguage();

  return (
    <StaticPage
      eyebrow={t('footer.column.legal')}
      title={t('footer.link.termini')}
      intro={t('termini.intro')}
    >
      <LegalSection title={t('termini.section1Title')}>{t('termini.section1Text')}</LegalSection>
      <LegalSection title={t('termini.section2Title')}>{t('termini.section2Text')}</LegalSection>
      <LegalSection title={t('termini.section3Title')}>{t('termini.section3Text')}</LegalSection>
      <LegalSection title={t('termini.section4Title')}>{t('termini.section4Text')}</LegalSection>
      <LegalSection title={t('termini.section5Title')}>{t('termini.section5Text')}</LegalSection>
      <LegalSection title={t('termini.section6Title')}>{t('termini.section6Text')}</LegalSection>
      <LegalSection title={t('termini.section7Title')}>{t('termini.section7Text')}</LegalSection>
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

export default TerminiPage;
