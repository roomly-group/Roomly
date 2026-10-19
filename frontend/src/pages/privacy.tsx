import { LegalIndex, LegalSection, StaticPage } from '@/components/layout/static-page';
import { useLanguage } from '@/lib/i18n';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Number of numbered clauses on this page (privacy.sectionNTitle / sectionNText). */
const SECTION_COUNT = 6 as const;

export function PrivacyPage() {
  const { t } = useLanguage();
  const sections = Array.from({ length: SECTION_COUNT }, (_, index) => ({
    id: `privacy-${index + 1}`,
    title: t(`privacy.section${index + 1}Title` as TranslationKey),
    text: t(`privacy.section${index + 1}Text` as TranslationKey),
  }));

  return (
    <StaticPage title={t('footer.link.privacy')} intro={t('privacy.intro')} aside={<LegalIndex sections={sections} />}>
      {sections.map((section) => (
        <LegalSection key={section.id} {...section} />
      ))}
    </StaticPage>
  );
}

export default PrivacyPage;
