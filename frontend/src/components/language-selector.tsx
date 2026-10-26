import { Check, Globe } from 'lucide-react';
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

      {/* Every language visible at once: one tap to switch, no dropdown to open. Native radios underneath. */}
      <div role="radiogroup" aria-labelledby="language-setting-title" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {LANGUAGES.map((lang) => {
          const selected = lang.code === language;
          return (
            <label
              key={lang.code}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-shutter ${
                selected ? 'border-shutter bg-mint-mist' : 'border-line bg-cream hover:border-outline hover:bg-mint-mist'
              }`}
              data-testid={`${LANGUAGE_SELECTOR_TEST_IDS.OPTION_LANGUAGE_SETTINGS_PREFIX}${lang.code}`}
            >
              <input
                type="radio"
                name="language-setting"
                value={lang.code}
                checked={selected}
                onChange={() => setLanguage(lang.code)}
                className="sr-only"
              />
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-black uppercase tracking-wide ${
                  selected ? 'bg-shutter text-mint-mist' : 'bg-paper text-pine'
                }`}
                aria-hidden
              >
                {lang.code}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-pine">{lang.label}</span>
              {selected ? <Check size={16} strokeWidth={3} className="shrink-0 text-shutter" aria-hidden /> : null}
            </label>
          );
        })}
      </div>
    </section>
  );
}
