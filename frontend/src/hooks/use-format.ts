import { useMemo } from 'react';
import { useLanguage } from '@/lib/i18n';
import { formatKm, formatLongDate, formatMonthYear, formatPrice, formatShortDate } from '@/lib/constants';

/** Price, distance and date formatters bound to the current UI language. */
export function useFormat() {
  const { language } = useLanguage();
  return useMemo(
    () => ({
      price: (value: number) => formatPrice(value, language),
      km: (value: number) => formatKm(value, language),
      date: (value: string | Date) => formatShortDate(value, language),
      monthYear: (value: string) => formatMonthYear(value, language),
      longDate: (value: string) => formatLongDate(value, language),
    }),
    [language],
  );
}
