import { LegalIndex, LegalSection, StaticPage } from '@/components/layout/static-page';
import { useLanguage } from '@/lib/i18n';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Number of numbered clauses on this page (cookie.sectionNTitle / sectionNText). */
const SECTION_COUNT = 5 as const;

export function CookiePage() {
  const { t } = useLanguage();
  const sections = Array.from({ length: SECTION_COUNT }, (_, index) => ({
    id: `cookie-${index + 1}`,
    title: t(`cookie.section${index + 1}Title` as TranslationKey),
    text: t(`cookie.section${index + 1}Text` as TranslationKey),
  }));

  return (
    <StaticPage title={t('footer.link.cookie')} intro={t('cookie.intro')} aside={<LegalIndex sections={sections} />}>
      {sections.map((section) => (
        <LegalSection key={section.id} {...section} />
      ))}
    </StaticPage>
  );
}

export default CookiePage;
