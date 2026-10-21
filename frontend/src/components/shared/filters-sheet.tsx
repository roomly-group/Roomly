import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Armchair, Cigarette, PawPrint, ReceiptText, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Switch } from '@/components/ui/switch';
import type { BrowseFlag } from '@/hooks/use-browse-params';
import { LISTING_FEATURE_GROUP_KEYS, LISTING_FEATURE_GROUP_OPTIONS } from '@/lib/constants';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];
export type FilterFlags = Record<BrowseFlag, boolean> & { features: string[] };

// ===================== CONFIGURATION =====================

/** Filter rows in display order. */
const FILTER_ROWS: { key: BrowseFlag; label: TranslationKey; icon: typeof Armchair }[] = [
  { key: 'furnished', label: 'common.furnished', icon: Armchair },
  { key: 'bills', label: 'filters.bills', icon: ReceiptText },
  { key: 'pets', label: 'filters.pets', icon: PawPrint },
  { key: 'smokers', label: 'filters.smokers', icon: Cigarette },
];
/** Stable selectors for the filters sheet. */
const FILTERS_SHEET_TEST_IDS = {
  SWITCH_PREFIX: 'switch-filter-',
  BUTTON_CLEAR: 'button-filters-clear',
  BUTTON_APPLY: 'button-filters-apply',
  FEATURE_PREFIX: 'chip-filter-',
} as const;

const NO_FILTERS: FilterFlags = { furnished: false, bills: false, pets: false, smokers: false, features: [] };

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
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-[20px] bg-paper pb-[env(safe-area-inset-bottom)] shadow-float data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-6 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-0 sm:data-[state=open]:slide-in-from-bottom-2"
        >
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <DialogPrimitive.Title className="text-lg font-black tracking-[-0.03em] text-pine">{t('filters.title')}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label={t('searchBar.close')}
              className="grid h-11 w-11 place-items-center rounded-full text-pine transition-colors hover:bg-mint-mist"
            >
              <X size={20} />
            </DialogPrimitive.Close>
          </div>

          <div className="overflow-y-auto">
          <ul className="px-6 py-2">
            {FILTER_ROWS.map((row) => {
              const Icon = row.icon;
              const id = `filter-${row.key}`;
              return (
                <li key={row.key} className="flex min-h-14 items-center justify-between gap-4 border-b border-line py-2 last:border-b-0">
                  <label htmlFor={id} className="flex flex-1 cursor-pointer items-center gap-3 text-[15px] font-extrabold text-ink">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint-mist text-shutter" aria-hidden>
                      <Icon size={18} />
                    </span>
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

          {LISTING_FEATURE_GROUP_KEYS.map((group) => (
            <fieldset key={group} className="border-t border-line px-6 py-4">
              <legend className="float-left mb-3 w-full text-sm font-black text-pine">
                {t(`newListing.group.${group}` as TranslationKey)}
              </legend>
              <div className="clear-both flex flex-wrap gap-2">
                {LISTING_FEATURE_GROUP_OPTIONS[group].map((option) => {
                  const key = `${group}.${option}`;
                  const on = draft.features.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          features: on ? current.features.filter((item) => item !== key) : [...current.features, key],
                        }))
                      }
                      className={`min-h-10 rounded-full border px-3.5 text-sm font-bold transition-colors ${
                        on ? 'border-shutter bg-shutter text-mint-mist' : 'border-line bg-paper text-ink hover:border-shutter'
                      }`}
                      data-testid={`${FILTERS_SHEET_TEST_IDS.FEATURE_PREFIX}${key}`}
                    >
                      {t(`newListing.feature.${option}` as TranslationKey)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
            <button
              type="button"
              onClick={() => setDraft(NO_FILTERS)}
              className="min-h-11 rounded-xl px-3 text-sm font-extrabold text-ink underline decoration-outline underline-offset-4 transition-colors hover:bg-mint-mist"
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
              className="h-12 rounded-xl bg-shutter px-5 text-sm font-black text-mint-mist transition-colors hover:bg-pine"
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
