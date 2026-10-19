import { BedSingle, Building2, Hotel, LayoutGrid, SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Property types from `tipologia_proprieta_enum`, plus "all". */
const CATEGORIES: { value: string; label: TranslationKey; icon: typeof LayoutGrid }[] = [
  { value: '', label: 'category.all', icon: LayoutGrid },
  { value: 'stanza', label: 'category.stanza', icon: BedSingle },
  { value: 'appartamento', label: 'category.appartamento', icon: Building2 },
  { value: 'residenza', label: 'category.residenza', icon: Hotel },
];
/** Stable selectors for the category strip. */
const CATEGORY_STRIP_TEST_IDS = {
  BUTTON_CATEGORY_PREFIX: 'button-category-',
  BUTTON_FILTERS: 'button-open-filters',
} as const;

/** Icon strip of property types; the "Filtri" button closes the row when the page has filters. */
export function CategoryStrip({
  value,
  onChange,
  filterCount = 0,
  onOpenFilters,
}: {
  value: string;
  onChange: (value: string) => void;
  filterCount?: number;
  onOpenFilters?: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex items-end gap-4 border-b border-line">
      <div role="group" aria-label={t('category.label')} className="no-scrollbar -mb-px flex min-w-0 flex-1 gap-8 overflow-x-auto pr-6 max-sm:[mask-image:linear-gradient(to_right,black_80%,transparent)]">
        {CATEGORIES.map((category) => {
          const active = value === category.value;
          const Icon = category.icon;
          return (
            <button
              key={category.value || 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(category.value)}
              className={cn(
                'flex min-h-11 shrink-0 flex-col items-center gap-2 border-b-[3px] pb-3 pt-1 text-xs font-extrabold transition-colors',
                active ? 'border-pine text-pine' : 'border-transparent text-sage hover:border-line hover:text-pine',
              )}
              data-testid={`${CATEGORY_STRIP_TEST_IDS.BUTTON_CATEGORY_PREFIX}${category.value || 'all'}`}
            >
              <Icon size={24} strokeWidth={1.8} aria-hidden />
              {t(category.label)}
            </button>
          );
        })}
      </div>

      {onOpenFilters && (
        <button
          type="button"
          onClick={onOpenFilters}
          className="mb-3 flex h-11 shrink-0 items-center gap-2 rounded-xl border border-outline px-4 text-sm font-extrabold text-pine transition-colors hover:border-shutter hover:bg-mint-mist"
          data-testid={CATEGORY_STRIP_TEST_IDS.BUTTON_FILTERS}
        >
          <SlidersHorizontal size={16} aria-hidden />
          <span className="hidden sm:inline">{t('filters.button')}</span>
          <span className="sr-only sm:hidden">{t('filters.button')}</span>
          {filterCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-pine px-1.5 text-[11px] font-black text-mint-mist">
              {filterCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
