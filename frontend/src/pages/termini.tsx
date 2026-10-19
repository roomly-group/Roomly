import { LegalIndex, LegalSection, StaticPage } from '@/components/layout/static-page';
import { useLanguage } from '@/lib/i18n';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Number of numbered clauses on this page (termini.sectionNTitle / sectionNText). */
const SECTION_COUNT = 7 as const;

export function TerminiPage() {
  const { t } = useLanguage();
  const sections = Array.from({ length: SECTION_COUNT }, (_, index) => ({
    id: `termini-${index + 1}`,
    title: t(`termini.section${index + 1}Title` as TranslationKey),
    text: t(`termini.section${index + 1}Text` as TranslationKey),
  }));

  return (
    <StaticPage title={t('footer.link.termini')} intro={t('termini.intro')} aside={<LegalIndex sections={sections} />}>
      {sections.map((section) => (
        <LegalSection key={section.id} {...section} />
      ))}
    </StaticPage>
  );
}

export default TerminiPage;
