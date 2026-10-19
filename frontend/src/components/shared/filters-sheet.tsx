import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Switch } from '@/components/ui/switch';
import type { BrowseFlag } from '@/hooks/use-browse-params';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];
export type FilterFlags = Record<BrowseFlag, boolean>;

// ===================== CONFIGURATION =====================

/** Filter rows in display order. */
const FILTER_ROWS: { key: BrowseFlag; label: TranslationKey }[] = [
  { key: 'furnished', label: 'common.furnished' },
  { key: 'bills', label: 'filters.bills' },
  { key: 'pets', label: 'filters.pets' },
  { key: 'smokers', label: 'filters.smokers' },
];
/** Stable selectors for the filters sheet. */
const FILTERS_SHEET_TEST_IDS = {
  SWITCH_PREFIX: 'switch-filter-',
  BUTTON_CLEAR: 'button-filters-clear',
  BUTTON_APPLY: 'button-filters-apply',
} as const;

const NO_FILTERS: FilterFlags = { furnished: false, bills: false, pets: false, smokers: false };

/**
 * Filters as a bottom sheet on phones and a centred dialog from 640px.
 * Changes stay a draft until "Mostra N stanze"; the count is live.
 */
export function FiltersSheet({
  open,
  onOpenChange,
  value,
  onApply,
  countFor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: FilterFlags;
  onApply: (flags: FilterFlags) => void;
  /** Number of rooms the current results would show with these flags. */
  countFor: (flags: FilterFlags) => number;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(value);

  // Every opening starts from what is applied, not from an abandoned draft.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const count = countFor(draft);
  const showLabel = count === 1 ? t('filters.showOne') : t('filters.show').replace('{n}', String(count));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-sheet bg-paper pb-[env(safe-area-inset-bottom)] shadow-float data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-6 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-sheet sm:pb-0 sm:data-[state=open]:slide-in-from-bottom-2"
        >
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <DialogPrimitive.Title className="text-lg font-black tracking-[-0.03em] text-pine">{t('filters.title')}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label={t('searchBar.close')}
              className="grid h-11 w-11 place-items-center rounded-control text-pine transition-colors hover:bg-mint-mist"
            >
              <X size={20} />
            </DialogPrimitive.Close>
          </div>

          <ul className="overflow-y-auto px-6 py-2">
            {FILTER_ROWS.map((row) => {
              const id = `filter-${row.key}`;
              return (
                <li key={row.key} className="flex min-h-14 items-center justify-between gap-4 border-b border-line py-2 last:border-b-0">
                  <label htmlFor={id} className="flex-1 cursor-pointer text-[15px] font-extrabold text-ink">
                    {t(row.label)}
                  </label>
                  <Switch
                    id={id}
                    checked={draft[row.key]}
                    onCheckedChange={(checked) => setDraft((current) => ({ ...current, [row.key]: checked }))}
                    className="data-[state=checked]:bg-shutter data-[state=unchecked]:bg-sage/75"
                    data-testid={`${FILTERS_SHEET_TEST_IDS.SWITCH_PREFIX}${row.key}`}
                  />
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
            <button
              type="button"
              onClick={() => setDraft(NO_FILTERS)}
              className="min-h-11 rounded-control px-3 text-sm font-extrabold text-ink underline decoration-outline underline-offset-4 transition-colors hover:bg-mint-mist"
              data-testid={FILTERS_SHEET_TEST_IDS.BUTTON_CLEAR}
            >
              {t('searchPage.clearFilters')}
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                onOpenChange(false);
              }}
              className="h-12 rounded-control bg-shutter px-5 text-sm font-black text-mint-mist transition-colors hover:bg-pine"
              data-testid={FILTERS_SHEET_TEST_IDS.BUTTON_APPLY}
            >
              {showLabel}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
