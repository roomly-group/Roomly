import { Globe } from 'lucide-react';
import { LANGUAGES, useLanguage } from '@/lib/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    <section className="surface rounded-2xl p-5 sm:p-6" data-testid={LANGUAGE_SELECTOR_TEST_IDS.SECTION_LANGUAGE_SETTING}>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="language-setting-title" className="flex items-center gap-2 text-xl font-black text-pine">
          <Globe size={18} className="text-shutter" aria-hidden />
          {t('settings.language')}
        </h2>
        <span
          className="rounded-full bg-mint-mist px-2.5 py-1 text-[11px] font-extrabold text-pine"
          data-testid={LANGUAGE_SELECTOR_TEST_IDS.TEXT_LANGUAGE_SOURCE}
        >
          {isAuto ? t('settings.languageAuto') : t('settings.languageManual')}
        </span>
      </div>

      {/* A dropdown, like everywhere else in the app (team feedback): one compact field instead of six tiles. */}
      <Select value={language} onValueChange={(value) => setLanguage(value as typeof language)}>
        <SelectTrigger
          aria-labelledby="language-setting-title"
          className="h-12 w-full gap-3 rounded-xl border-field bg-paper px-3.5 text-[15px] font-extrabold text-pine shadow-none focus:ring-[3px] focus:ring-mint-wash/40 sm:max-w-xs"
          data-testid={LANGUAGE_SELECTOR_TEST_IDS.SELECT_LANGUAGE_SETTINGS}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-line bg-paper p-1 shadow-float">
          {LANGUAGES.map((lang) => (
            <SelectItem
              key={lang.code}
              value={lang.code}
              className="min-h-11 cursor-pointer rounded-lg text-[15px] font-bold text-pine focus:bg-mint-mist focus:text-pine"
              data-testid={`${LANGUAGE_SELECTOR_TEST_IDS.OPTION_LANGUAGE_SETTINGS_PREFIX}${lang.code}`}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-mint-mist text-[11px] font-black uppercase tracking-wide text-pine" aria-hidden>
                  {lang.code}
                </span>
                {lang.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  );
}
