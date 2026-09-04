import { Globe } from 'lucide-react';
import { LANGUAGES, useLanguage } from '@/lib/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
        className={`h-9 w-auto gap-1.5 rounded-full border-[#0850411f] bg-white/70 px-3 text-sm font-bold text-[#085041] ${className}`}
        data-testid="select-language-picker"
        aria-label={t('settings.language')}
      >
        <Globe size={14} />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code} data-testid={`option-language-picker-${lang.code}`}>
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
    <section className="surface rounded-2xl p-5 sm:p-7" data-testid="section-language-setting">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-[#E1F5EE] p-2.5 text-[#0F6E56]">
          <Globe size={18} />
        </span>
        <div className="flex-1">
          <p className="eyebrow">{t('settings.language')}</p>
          <h2 className="mt-1 text-lg font-black text-[#085041]">{t('settings.language')}</h2>
          <p className="mt-1 text-sm leading-6 text-[#527067]">{t('settings.languageDesc')}</p>
          <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-[#0F6E56]" data-testid="text-language-source">
            {isAuto ? t('settings.languageAuto') : t('settings.languageManual')}
          </p>
          <div className="mt-4 max-w-xs">
            <Select value={language} onValueChange={(value) => setLanguage(value as typeof language)}>
              <SelectTrigger data-testid="select-language-settings" aria-label={t('settings.language')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code} data-testid={`option-language-settings-${lang.code}`}>
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
