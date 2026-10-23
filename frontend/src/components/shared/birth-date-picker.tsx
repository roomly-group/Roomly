import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker, type DayButtonProps } from 'react-day-picker';
import { de, enGB, es, fr, it, pt } from 'react-day-picker/locale';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage, type LanguageCode } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// ===================== CONFIGURATION =====================

/** Youngest age allowed to register: later birth dates can't be picked. */
const MIN_AGE_YEARS = 18;
/** Oldest age offered in the year list. */
const MAX_AGE_YEARS = 100;
/** Columns of the year and month grids (used for arrow-key moves too). */
const YEAR_COLUMNS = 4;
const MONTH_COLUMNS = 3;

/** Weekday names and first day of the week for the day grid. */
const DAY_PICKER_LOCALES = { en: enGB, it, es, fr, de, pt } as const;
/** Locale used to write dates and month names. */
const INTL_LOCALES: Record<LanguageCode, string> = {
  en: 'en-GB',
  it: 'it-IT',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-PT',
};

type View = 'year' | 'month' | 'day';

// ===================== HELPERS =====================

const pad = (n: number) => String(n).padStart(2, '0');

/** Date -> "yyyy-MM-dd" in local time (what the register API expects). */
function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "yyyy-MM-dd" -> local Date, or undefined for an empty or malformed value. */
function fromIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** Moves focus inside a grid of buttons with the arrow keys. */
function handleGridKeys(event: KeyboardEvent<HTMLDivElement>, columns: number) {
  const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
  const step = steps[event.key];
  if (!step) return;
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = buttons[Math.min(Math.max(current + step, 0), buttons.length - 1)];
  if (next) {
    event.preventDefault();
    next.focus();
  }
}

// ===================== COMPONENT =====================

type BirthDatePickerProps = {
  id: string;
  /** "yyyy-MM-dd", or '' when nothing is picked yet. */
  value: string;
  onChange: (value: string) => void;
  testId?: string;
};

/**
 * Date of birth field: a Roomly-styled trigger that opens a calendar.
 * Picking goes year -> month -> day, so nobody pages back twenty years
 * month by month. Dates that would make the user younger than 18 are off.
 */
export function BirthDatePicker({ id, value, onChange, testId }: BirthDatePickerProps) {
  const { t, language } = useLanguage();
  const intlLocale = INTL_LOCALES[language];
  const selected = fromIsoDate(value);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('year');
  const [month, setMonth] = useState<Date>(() => new Date());
  const [browsing, setBrowsing] = useState(false);
  const yearGridRef = useRef<HTMLDivElement>(null);
  const monthGridRef = useRef<HTMLDivElement>(null);

  const { latest, earliest } = useMemo(() => {
    const today = new Date();
    return {
      latest: new Date(today.getFullYear() - MIN_AGE_YEARS, today.getMonth(), today.getDate()),
      earliest: new Date(today.getFullYear() - MAX_AGE_YEARS, 0, 1),
    };
  }, []);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = latest.getFullYear(); year >= earliest.getFullYear(); year--) list.push(year);
    return list;
  }, [latest, earliest]);

  const formats = useMemo(
    () => ({
      full: new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'long', year: 'numeric' }),
      monthLong: new Intl.DateTimeFormat(intlLocale, { month: 'long' }),
      monthShort: new Intl.DateTimeFormat(intlLocale, { month: 'short' }),
    }),
    [intlLocale],
  );

  function handleOpenChange(next: boolean) {
    if (next) {
      // Reopening with a date lands on its month; a fresh field starts at the year list.
      setView(selected ? 'day' : 'year');
      setMonth(selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date(latest.getFullYear(), 0, 1));
      setBrowsing(Boolean(selected));
    }
    setOpen(next);
  }

  // The popover skips its own autofocus; put focus on the picked (or first) item of the open view.
  useEffect(() => {
    if (!open) return;
    const grid = view === 'year' ? yearGridRef.current : view === 'month' ? monthGridRef.current : null;
    if (!grid) return;
    const target =
      grid.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ??
      grid.querySelector<HTMLButtonElement>('button:not(:disabled)');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'center' });
  }, [open, view]);

  const highlightedYear = selected?.getFullYear() ?? (browsing ? month.getFullYear() : null);
  const shownYear = month.getFullYear();
  const isLatestYear = shownYear === latest.getFullYear();
  const canGoBack = month > new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const canGoForward = month < new Date(latest.getFullYear(), latest.getMonth(), 1);

  function pickYear(year: number) {
    const monthIndex = year === latest.getFullYear() ? Math.min(month.getMonth(), latest.getMonth()) : month.getMonth();
    setMonth(new Date(year, monthIndex, 1));
    setBrowsing(true);
    setView('month');
  }

  function pickMonth(monthIndex: number) {
    setMonth(new Date(shownYear, monthIndex, 1));
    setView('day');
  }

  function stepMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  const chipClass =
    'inline-flex h-9 items-center gap-1 rounded-full px-3 text-[15px] font-black text-pine transition-colors hover:bg-mint-mist';
  const arrowClass =
    'grid h-9 w-9 place-items-center rounded-full text-pine transition-colors hover:bg-mint-mist disabled:pointer-events-none disabled:text-sage-placeholder/50';

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          data-testid={testId}
          className="group relative flex h-12 w-full items-center rounded-[10px] border border-field bg-paper pl-9 pr-10 text-left text-base text-ink transition-[border-color,box-shadow] focus-visible:border-shutter focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mint-wash/40 data-[state=open]:border-shutter data-[state=open]:ring-[3px] data-[state=open]:ring-mint-wash/40"
        >
          <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage" aria-hidden />
          {selected ? (
            <span className="truncate font-semibold">{formats.full.format(selected)}</span>
          ) : (
            <span className="truncate text-sage-placeholder">{t('auth.dateOfBirthPlaceholder')}</span>
          )}
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sage transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-50 w-[328px] max-w-[calc(100vw-2rem)] origin-[var(--radix-popover-content-transform-origin)] rounded-2xl border border-line bg-paper p-3 text-ink shadow-float outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:animate-none"
        >
          {/* Header: where you are, and a way back up to month or year. */}
          <div className="mb-2 flex h-10 items-center justify-between gap-2">
            {view === 'year' ? (
              <p className="px-2 text-[15px] font-black text-pine">{t('auth.dateOfBirthPickYear')}</p>
            ) : (
              <div className="flex items-center">
                {view === 'day' ? (
                  <button
                    type="button"
                    className={chipClass}
                    onClick={() => setView('month')}
                    aria-label={`${capitalize(formats.monthLong.format(month))}, ${t('auth.dateOfBirthChangeMonth')}`}
                  >
                    {capitalize(formats.monthLong.format(month))}
                    <ChevronDown size={14} className="text-sage" aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  className={cn(chipClass, 'tabular-nums', view === 'month' && 'bg-mint-mist')}
                  onClick={() => setView('year')}
                  aria-label={`${shownYear}, ${t('auth.dateOfBirthChangeYear')}`}
                >
                  {shownYear}
                  <ChevronDown size={14} className="text-sage" aria-hidden />
                </button>
              </div>
            )}

            {view === 'day' ? (
              <div className="flex items-center">
                <button
                  type="button"
                  className={arrowClass}
                  onClick={() => stepMonth(-1)}
                  disabled={!canGoBack}
                  aria-label={t('auth.dateOfBirthPrevMonth')}
                >
                  <ChevronLeft size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  className={arrowClass}
                  onClick={() => stepMonth(1)}
                  disabled={!canGoForward}
                  aria-label={t('auth.dateOfBirthNextMonth')}
                >
                  <ChevronRight size={18} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>

          {/* Body: same height in every view so the popover never jumps. */}
          <div key={view} className="h-[272px] animate-in fade-in-0 duration-150 motion-reduce:animate-none">
            {view === 'year' ? (
              <div
                ref={yearGridRef}
                role="group"
                aria-label={t('auth.dateOfBirthPickYear')}
                onKeyDown={(event) => handleGridKeys(event, YEAR_COLUMNS)}
                className="grid h-full grid-cols-4 content-start gap-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]"
              >
                {years.map((year) => {
                  const isPicked = year === highlightedYear;
                  return (
                    <button
                      key={year}
                      type="button"
                      aria-pressed={isPicked}
                      onClick={() => pickYear(year)}
                      className={cn(
                        'h-10 rounded-full text-[15px] font-bold tabular-nums text-ink transition-colors hover:bg-mint-mist hover:text-pine',
                        isPicked && 'bg-shutter font-black text-mint-mist hover:bg-shutter hover:text-mint-mist',
                      )}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {view === 'month' ? (
              <div
                ref={monthGridRef}
                role="group"
                aria-label={String(shownYear)}
                onKeyDown={(event) => handleGridKeys(event, MONTH_COLUMNS)}
                className="grid h-full grid-cols-3 grid-rows-4 gap-1.5"
              >
                {Array.from({ length: 12 }, (_, monthIndex) => {
                  const date = new Date(shownYear, monthIndex, 1);
                  const isPicked = selected?.getFullYear() === shownYear && selected.getMonth() === monthIndex;
                  const isOff = isLatestYear && monthIndex > latest.getMonth();
                  return (
                    <button
                      key={monthIndex}
                      type="button"
                      aria-pressed={isPicked}
                      aria-label={capitalize(formats.monthLong.format(date))}
                      disabled={isOff}
                      onClick={() => pickMonth(monthIndex)}
                      className={cn(
                        'rounded-xl text-[15px] font-bold text-ink transition-colors hover:bg-mint-mist hover:text-pine disabled:pointer-events-none disabled:text-sage-placeholder/50',
                        isPicked && 'bg-shutter font-black text-mint-mist hover:bg-shutter hover:text-mint-mist',
                      )}
                    >
                      {capitalize(formats.monthShort.format(date).replace('.', ''))}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {view === 'day' ? (
              <DayPicker
                mode="single"
                required
                autoFocus
                locale={DAY_PICKER_LOCALES[language]}
                month={month}
                onMonthChange={setMonth}
                selected={selected}
                onSelect={(date) => {
                  onChange(toIsoDate(date));
                  setOpen(false);
                }}
                startMonth={earliest}
                endMonth={latest}
                disabled={[{ after: latest }, { before: earliest }]}
                hideNavigation
                showOutsideDays
                fixedWeeks
                components={{ DayButton: CalendarDayButton }}
                classNames={{
                  root: 'w-full',
                  months: 'w-full',
                  month: 'w-full',
                  month_caption: 'sr-only',
                  month_grid: 'w-full border-collapse',
                  weekday: 'h-8 p-0 text-[11px] font-black uppercase tracking-[0.08em] text-sage-placeholder',
                  day: 'p-0 text-center',
                }}
              />
            ) : null}
          </div>

          <p className="mt-2 border-t border-line px-2 pt-2.5 text-xs font-semibold text-sage">{t('auth.ageUnder18')}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** One day of the grid: round, mint on hover, solid shutter green when picked. */
function CalendarDayButton({ day: _day, modifiers, className, ...props }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  // Keyboard navigation in the grid relies on the focused day taking focus.
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      {...props}
      className={cn(
        className,
        'mx-auto grid h-10 w-10 place-items-center rounded-full text-[15px] font-semibold tabular-nums text-ink transition-colors hover:bg-mint-mist hover:text-pine',
        modifiers.outside && 'text-sage-placeholder',
        modifiers.selected && 'bg-shutter font-black text-mint-mist hover:bg-shutter hover:text-mint-mist',
        modifiers.disabled && 'cursor-not-allowed text-sage-placeholder/40 hover:bg-transparent hover:text-sage-placeholder/40',
      )}
    />
  );
}
