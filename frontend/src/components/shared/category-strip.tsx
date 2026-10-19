import { SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Property types from `tipologia_proprieta_enum`, plus "all", with their legend swatch. */
const CATEGORIES: { value: string; label: TranslationKey; swatch: string }[] = [
  { value: '', label: 'category.all', swatch: '' },
  { value: 'stanza', label: 'category.stanza', swatch: 'bg-shutter' },
  { value: 'appartamento', label: 'category.appartamento', swatch: 'bg-pine' },
  { value: 'residenza', label: 'category.residenza', swatch: 'bg-mint-wash ring-1 ring-inset ring-pine/50' },
];
/** Stable selectors for the legend. */
const CATEGORY_STRIP_TEST_IDS = {
  BUTTON_CATEGORY_PREFIX: 'button-category-',
  BUTTON_FILTERS: 'button-open-filters',
} as const;

/** The legend square for a property type; the same mark tags a listing's type on its card. */
export function TypeSwatch({ type, className }: { type: string | null | undefined; className?: string }) {
  const swatch = CATEGORIES.find((category) => category.value === type)?.swatch;
  if (!swatch) return null;
  return <span aria-hidden className={cn('inline-block h-2.5 w-2.5 shrink-0', swatch, className)} />;
}

/**
 * The map legend: property types as square swatches with their real counts,
 * the active one underlined; "Filtri (n)" closes the line when the page has filters.
 */
export function CategoryStrip({
  value,
  onChange,
  counts,
  filterCount = 0,
  onOpenFilters,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Rooms per type in the current results ('' = all); counts are omitted while unknown. */
  counts?: Record<string, number>;
  filterCount?: number;
  onOpenFilters?: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex items-end gap-6 border-b border-line">
      <div
        role="group"
        aria-label={t('category.label')}
        className="no-scrollbar -mb-px flex min-w-0 flex-1 gap-7 overflow-x-auto pr-10 max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]"
      >
        {CATEGORIES.map((category) => {
          const active = value === category.value;
          const count = counts?.[category.value];
          // A type with no rooms here cannot be chosen (the active one always can be left).
          const empty = count === 0 && !active && category.value !== '';
          return (
            <button
              key={category.value || 'all'}
              type="button"
              aria-pressed={active}
              disabled={empty}
              onClick={() => onChange(category.value)}
              className={cn(
                'flex min-h-12 shrink-0 items-center gap-2 border-b-[3px] text-[13px] font-extrabold transition-colors',
                active
                  ? 'border-pine text-pine'
                  : empty
                    ? 'cursor-default border-transparent text-sage/60'
                    : 'border-transparent text-sage hover:text-pine',
              )}
              data-testid={`${CATEGORY_STRIP_TEST_IDS.BUTTON_CATEGORY_PREFIX}${category.value || 'all'}`}
            >
              {category.swatch && <span aria-hidden className={cn('h-2.5 w-2.5', category.swatch, empty && 'opacity-40')} />}
              {t(category.label)}
              {count !== undefined && <span className="font-black tabular-nums text-sage">{count}</span>}
            </button>
          );
        })}
      </div>

      {onOpenFilters && (
        <button
          type="button"
          onClick={onOpenFilters}
          className="mb-1.5 flex min-h-11 shrink-0 items-center gap-2 rounded-control px-2 text-[13px] font-extrabold text-pine underline decoration-outline underline-offset-4 transition-colors hover:decoration-shutter hover:decoration-2"
          data-testid={CATEGORY_STRIP_TEST_IDS.BUTTON_FILTERS}
        >
          <SlidersHorizontal size={15} aria-hidden />
          {t('filters.button')}
          {filterCount > 0 && <span className="font-black tabular-nums">({filterCount})</span>}
        </button>
      )}
    </div>
  );
}
