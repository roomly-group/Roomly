import { useLanguage } from '@/lib/i18n';
import { zoneTranslationKeys } from '@/lib/constants';

// Zone values are matched against the backend's own listing data, so the
// value sent to the API always stays in English — only the visible label
// is translated.
export function useZoneLabel() {
  const { t } = useLanguage();
  return (zone: string) => {
    const key = zoneTranslationKeys[zone];
    return key ? t(key) : zone;
  };
}
