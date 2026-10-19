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
/** Stable selectors for the search controls. */
const SEARCH_TEST_IDS = {
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

const FIELD_CLASS =
  'flex h-12 items-center gap-2 rounded-control border border-field bg-paper px-3 focus-within:border-shutter focus-within:ring-[3px] focus-within:ring-mint-wash/40';

/**
 * The browse search as one sentence on the pine band:
 * "Stanze vicino a [università] fino a [€] al mese [Cerca]".
 * Phones get one field-shaped button that opens a full-screen sheet.
 * The URL is the source of truth; the fields hold drafts until applied.
 */
export function SearchSentence() {
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

  const budgetInput = (testId: string, extraClass = '') => (
    <input
      type="text"
      inputMode="numeric"
      value={budget}
      onChange={(event) => setBudget(event.target.value.replace(/\D/g, ''))}
      onBlur={() => {
        if (onSearchPage && sanitizeBudget(budget) !== params.maxPrice) update({ maxPrice: budget });
      }}
      placeholder={t('searchBar.budgetPrompt')}
      aria-label={t('searchBar.budget')}
      className={`w-full min-w-0 bg-transparent font-bold tabular-nums text-ink outline-none placeholder:text-sage ${extraClass}`}
      data-testid={testId}
    />
  );

  return (
    <>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
        className="hidden flex-wrap items-center gap-x-3 gap-y-3 text-[17px] font-extrabold text-mint-mist sm:flex lg:flex-nowrap"
        data-testid={SEARCH_TEST_IDS.FORM}
      >
        <span className="shrink-0">{t('searchBar.sentenceNear')}</span>
        <LocationSearch
          className="min-w-[240px] flex-1 lg:max-w-[420px] [&>div]:h-12"
          value={zone}
          onChange={setZone}
          onSelect={(place) => update({ zone: place, maxPrice: budget })}
          options={universities}
          loading={loading}
          placeholder={t('searchBar.universityPrompt')}
          aria-label={t('searchBar.university')}
          inputClassName="text-[15px]"
          data-testid={SEARCH_TEST_IDS.INPUT_UNIVERSITY}
        />
        <span className="shrink-0">{t('searchBar.sentenceUpTo')}</span>
        <label className={`${FIELD_CLASS} w-[180px] shrink-0`}>
          <span className="font-black text-shutter" aria-hidden>
            €
          </span>
          {budgetInput(SEARCH_TEST_IDS.INPUT_BUDGET, 'text-[15px]')}
        </label>
        <span className="shrink-0">{t('searchBar.sentenceMonth')}</span>
        <button
          type="submit"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-control bg-sun px-6 text-[15px] font-black text-ink transition-[background-color,transform] duration-150 hover:bg-sun-hover active:translate-y-px"
          data-testid={SEARCH_TEST_IDS.BUTTON_SEARCH}
        >
          <Search size={17} strokeWidth={2.6} aria-hidden /> {t('searchBar.go')}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex min-h-12 w-full items-center gap-3 rounded-control bg-paper px-4 py-2 text-left sm:hidden"
        data-testid={SEARCH_TEST_IDS.BUTTON_OPEN_MOBILE}
      >
        <Search size={18} strokeWidth={2.4} className="shrink-0 text-pine" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold text-pine">{params.zone || t('searchBar.mobilePrompt')}</span>
          <span className="block truncate text-xs font-bold text-sage">{summary}</span>
        </span>
      </button>

      <DialogPrimitive.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex flex-col bg-ground data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <div className="flex h-16 items-center justify-between gap-4 bg-pine px-5 text-mint-mist">
              <DialogPrimitive.Title className="text-lg font-black tracking-[-0.02em]">{t('searchBar.mobilePrompt')}</DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label={t('searchBar.close')}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-mint-mist hover:bg-mint-mist/10"
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
              className="flex flex-1 flex-col gap-6 px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-6"
            >
              <div>
                <span className="mb-2 block text-[13px] font-extrabold text-pine">{t('searchBar.university')}</span>
                <LocationSearch
                  value={zone}
                  onChange={setZone}
                  options={universities}
                  loading={loading}
                  placeholder={t('searchBar.universityPrompt')}
                  aria-label={t('searchBar.university')}
                  inputClassName="text-base"
                  data-testid={SEARCH_TEST_IDS.INPUT_SHEET_UNIVERSITY}
                />
              </div>
              <label className="block">
                <span className="mb-2 block text-[13px] font-extrabold text-pine">{t('searchBar.budget')}</span>
                <span className={FIELD_CLASS}>
                  <span className="font-black text-shutter" aria-hidden>
                    €
                  </span>
                  {budgetInput(SEARCH_TEST_IDS.INPUT_SHEET_BUDGET, 'text-base')}
                </span>
              </label>
              <button
                type="submit"
                className="mt-auto flex h-[52px] items-center justify-center gap-2 rounded-control bg-sun text-base font-black text-ink transition-colors hover:bg-sun-hover"
                data-testid={SEARCH_TEST_IDS.BUTTON_SHEET_SEARCH}
              >
                <Search size={18} strokeWidth={2.6} aria-hidden /> {t('searchBar.search')}
              </button>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

/** One-row header shortcut on pages where another action owns the amber: a text link on the pine band. */
export function CompactSearch() {
  const { t } = useLanguage();
  return (
    <Link
      href={APP_ROUTES.SEARCH}
      className="hidden min-h-11 items-center gap-2 rounded-control px-2 text-[15px] font-extrabold text-mint-mist underline decoration-mint-mist/40 underline-offset-4 transition-colors hover:decoration-mint-wash xl:inline-flex"
      data-testid={SEARCH_TEST_IDS.LINK_COMPACT}
    >
      <Search size={16} strokeWidth={2.6} aria-hidden /> {t('searchBar.compact')}
    </Link>
  );
}
