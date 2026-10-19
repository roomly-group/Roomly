import { Globe } from 'lucide-react';
import { LANGUAGES, useLanguage } from '@/lib/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionHead } from '@/components/shared/section-head';

// ===================== CONFIGURATION =====================

/** Stable test selectors used by language picker and profile language settings. */
const LANGUAGE_SELECTOR_TEST_IDS = {
  SELECT_LANGUAGE_PICKER: 'select-language-picker',
  OPTION_LANGUAGE_PICKER_PREFIX: 'option-language-picker-',
  SECTION_LANGUAGE_SETTING: 'section-language-setting',
  TEXT_LANGUAGE_SOURCE: 'text-language-source',
  SELECT_LANGUAGE_SETTINGS: 'select-language-settings',
  OPTION_LANGUAGE_SETTINGS_PREFIX: 'option-language-settings-',
} as const;

/**
 * Compact language switcher — a flag + dropdown, no label or description.
 * Meant for public pages that sit outside AppShell (login, register,
 * waitlist, waitlist-confirmed) where there's no Settings page to reach.
 * Reuses the same useLanguage()/setLanguage() as LanguageSetting below, so
 * picking a language here also persists it (locally, and to the account
 * once the user is signed in).
 */
export function LanguagePicker({ className = '' }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <Select value={language} onValueChange={(value) => setLanguage(value as typeof language)}>
      <SelectTrigger
        className={`h-9 w-auto gap-1.5 rounded-full border-pine/12 bg-paper px-3 text-sm font-bold text-pine ${className}`}
        data-testid={LANGUAGE_SELECTOR_TEST_IDS.SELECT_LANGUAGE_PICKER}
        aria-label={t('settings.language')}
      >
        <Globe size={14} />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code} data-testid={`${LANGUAGE_SELECTOR_TEST_IDS.OPTION_LANGUAGE_PICKER_PREFIX}${lang.code}`}>
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Full language setting row — lives in the user's Settings / Profile page
 * only. Shows the current language, whether it was auto-detected from the
 * user's region or chosen manually, and lets the user override it. The
 * choice is saved per user (see LanguageProvider), never shown or changeable
 * from the navigation bar.
 */
export function LanguageSetting() {
  const { language, setLanguage, isAuto, t } = useLanguage();
  return (
    <section aria-labelledby="language-setting" data-testid={LANGUAGE_SELECTOR_TEST_IDS.SECTION_LANGUAGE_SETTING}>
      <SectionHead id="language-setting" title={t('settings.language')} />
      <div className="mt-4">
        <div>
          <p className="max-w-xl text-[15px] leading-6 text-ink">{t('settings.languageDesc')}</p>
          <p className="mt-2 text-[13px] font-extrabold text-shutter" data-testid={LANGUAGE_SELECTOR_TEST_IDS.TEXT_LANGUAGE_SOURCE}>
            {isAuto ? t('settings.languageAuto') : t('settings.languageManual')}
          </p>
          <div className="mt-4 max-w-xs">
            <Select value={language} onValueChange={(value) => setLanguage(value as typeof language)}>
              <SelectTrigger data-testid={LANGUAGE_SELECTOR_TEST_IDS.SELECT_LANGUAGE_SETTINGS} aria-label={t('settings.language')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code} data-testid={`${LANGUAGE_SELECTOR_TEST_IDS.OPTION_LANGUAGE_SETTINGS_PREFIX}${lang.code}`}>
                    <span className="mr-2">{lang.flag}</span>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </section>
  );
}
