import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, X } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/lib/i18n';
import { useFormat } from '@/hooks/use-format';
import { useUniversities } from '@/hooks/use-universities';
import { sanitizeBudget, useBrowseParams } from '@/hooks/use-browse-params';
import { LocationSearch } from '@/components/shared/location-search';
import { APP_ROUTES } from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Pause after the last budget keystroke before the results refilter (ms). */
const BUDGET_DEBOUNCE_MS = 400 as const;
/** Stable selectors for the search pill controls. */
const SEARCH_PILL_TEST_IDS = {
  FORM: 'form-search-pill',
  INPUT_UNIVERSITY: 'input-pill-university',
  INPUT_BUDGET: 'input-pill-budget',
  BUTTON_SEARCH: 'button-pill-search',
  BUTTON_OPEN_MOBILE: 'button-open-search-sheet',
  INPUT_SHEET_UNIVERSITY: 'input-sheet-university',
  INPUT_SHEET_BUDGET: 'input-sheet-budget',
  BUTTON_SHEET_SEARCH: 'button-sheet-search',
  LINK_COMPACT: 'link-compact-search',
} as const;

/**
 * The browse header's search: a pill (Università · Budget mensile · amber orb)
 * from 640px, a single tappable pill that opens a full-screen sheet below.
 * The URL is the source of truth; the fields hold drafts until applied.
 */
export function SearchPill() {
  const { t } = useLanguage();
  const format = useFormat();
  const { params, update, onSearchPage } = useBrowseParams();
  const { universities, loading } = useUniversities();
  const [zone, setZone] = useState(params.zone);
  const [budget, setBudget] = useState(params.maxPrice);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Back/forward or "clear filters" change the URL: mirror it in the drafts.
  useEffect(() => setZone(params.zone), [params.zone]);
  useEffect(() => setBudget(params.maxPrice), [params.maxPrice]);

  // On the results page the budget refilters on its own after a short pause.
  useEffect(() => {
    if (!onSearchPage || sanitizeBudget(budget) === params.maxPrice) return;
    const timer = window.setTimeout(() => update({ maxPrice: budget }), BUDGET_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [budget, onSearchPage, params.maxPrice, update]);

  const apply = () => update({ zone, maxPrice: budget });

  const summary = params.maxPrice
    ? t('searchPage.underBudget').replace('{price}', format.price(Number(params.maxPrice)))
    : t('searchBar.mobileHint');

  return (
    <>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
        className="relative mx-auto hidden h-[66px] w-full max-w-[760px] items-center rounded-full border border-pine/10 bg-paper shadow-float sm:flex"
        data-testid={SEARCH_PILL_TEST_IDS.FORM}
      >
        <div className="flex h-full min-w-0 flex-[1.4] flex-col justify-center rounded-full py-1.5 pl-7 pr-3 transition-colors hover:bg-cream focus-within:bg-cream">
          <span className="text-xs font-black text-pine" aria-hidden>
            {t('searchBar.university')}
          </span>
          <LocationSearch
            appearance="bare"
            value={zone}
            onChange={setZone}
            onSelect={(place) => update({ zone: place, maxPrice: budget })}
            options={universities}
            loading={loading}
            placeholder={t('searchBar.universityPrompt')}
            aria-label={t('searchBar.university')}
            data-testid={SEARCH_PILL_TEST_IDS.INPUT_UNIVERSITY}
          />
        </div>

        <span aria-hidden className="h-8 w-px shrink-0 bg-line" />

        <label className="flex h-full min-w-0 flex-1 cursor-text flex-col justify-center rounded-full py-1.5 pl-6 pr-[74px] transition-colors hover:bg-cream focus-within:bg-cream">
          <span className="text-xs font-black text-pine">{t('searchBar.budget')}</span>
          <span className="flex items-center gap-1">
            <span className="text-sm font-black text-shutter" aria-hidden>
              €
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={budget}
              onChange={(event) => setBudget(event.target.value.replace(/\D/g, ''))}
              onBlur={() => {
                if (onSearchPage && sanitizeBudget(budget) !== params.maxPrice) update({ maxPrice: budget });
              }}
              placeholder={t('searchBar.budgetPrompt')}
              className="w-full min-w-0 bg-transparent text-sm font-bold tabular-nums text-ink outline-none placeholder:text-sage"
              data-testid={SEARCH_PILL_TEST_IDS.INPUT_BUDGET}
            />
          </span>
        </label>

        <button
          type="submit"
          aria-label={t('searchBar.search')}
          title={t('searchBar.search')}
          className="absolute right-2 top-1/2 flex h-[50px] w-[50px] -translate-y-1/2 items-center justify-center rounded-full bg-sun text-ink transition-[background-color,transform] duration-200 hover:bg-sun-hover active:scale-[0.96]"
          data-testid={SEARCH_PILL_TEST_IDS.BUTTON_SEARCH}
        >
          <Search size={20} strokeWidth={2.6} />
        </button>
      </form>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex min-h-14 w-full items-center gap-3 rounded-full border border-pine/10 bg-paper py-2 pl-5 pr-2 text-left shadow-lift sm:hidden"
        data-testid={SEARCH_PILL_TEST_IDS.BUTTON_OPEN_MOBILE}
      >
        <Search size={19} strokeWidth={2.4} className="shrink-0 text-pine" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-pine">{params.zone || t('searchBar.mobilePrompt')}</span>
          <span className="block truncate text-xs font-bold text-sage">{summary}</span>
        </span>
      </button>

      <DialogPrimitive.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex flex-col bg-cream px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4"
          >
            <div className="flex items-center justify-between gap-4">
              <DialogPrimitive.Title className="text-2xl font-black tracking-[-0.04em] text-pine">
                {t('searchBar.mobilePrompt')}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label={t('searchBar.close')}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-outline text-pine"
              >
                <X size={20} />
              </DialogPrimitive.Close>
            </div>

            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                apply();
                setSheetOpen(false);
              }}
              className="mt-7 flex flex-1 flex-col gap-5"
            >
              <div>
                <span className="mb-2 block text-sm font-black text-pine">{t('searchBar.university')}</span>
                <LocationSearch
                  value={zone}
                  onChange={setZone}
                  options={universities}
                  loading={loading}
                  placeholder={t('searchBar.universityPrompt')}
                  aria-label={t('searchBar.university')}
                  data-testid={SEARCH_PILL_TEST_IDS.INPUT_SHEET_UNIVERSITY}
                />
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-pine">{t('searchBar.budget')}</span>
                <span className="flex min-h-12 items-center gap-2 rounded-xl border border-field bg-cream px-3 focus-within:border-shutter focus-within:ring-[3px] focus-within:ring-mint-wash/40">
                  <span className="font-black text-shutter" aria-hidden>
                    €
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value.replace(/\D/g, ''))}
                    placeholder={t('searchBar.budgetPrompt')}
                    className="w-full min-w-0 bg-transparent text-base font-bold tabular-nums text-ink outline-none placeholder:text-sage"
                    data-testid={SEARCH_PILL_TEST_IDS.INPUT_SHEET_BUDGET}
                  />
                </span>
              </label>
              <button
                type="submit"
                className="mt-auto flex h-[52px] items-center justify-center gap-2 rounded-xl bg-sun text-base font-black text-ink transition-colors hover:bg-sun-hover"
                data-testid={SEARCH_PILL_TEST_IDS.BUTTON_SHEET_SEARCH}
              >
                <Search size={18} strokeWidth={2.6} /> {t('searchBar.search')}
              </button>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

/** One-row header shortcut on pages where another action owns the amber: a green orb, never amber. */
export function CompactSearchPill() {
  const { t } = useLanguage();
  return (
    <Link
      href={APP_ROUTES.SEARCH}
      className="hidden h-12 items-center gap-3 rounded-full border border-pine/10 bg-paper pl-5 pr-1.5 shadow-rest transition-shadow hover:shadow-lift xl:flex"
      data-testid={SEARCH_PILL_TEST_IDS.LINK_COMPACT}
    >
      <span className="text-sm font-extrabold text-ink">{t('searchBar.compact')}</span>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-shutter text-mint-mist" aria-hidden>
        <Search size={16} strokeWidth={2.6} />
      </span>
    </Link>
  );
}
