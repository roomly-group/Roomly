import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { GraduationCap, MapPin, Search, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// Lowercase + strip accents so "universita" finds "Università".
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const SUGGESTED_COUNT = 6;
const RESULTS_COUNT = 8;

function rank(options: string[], query: string): string[] {
  const q = normalize(query);
  if (!q) return options.slice(0, SUGGESTED_COUNT);

  const starts: string[] = [];
  const wordStarts: string[] = [];
  const contains: string[] = [];

  for (const option of options) {
    const n = normalize(option);
    if (n.startsWith(q)) starts.push(option);
    else if (n.split(/[\s'’\-]+/).some((word) => word.startsWith(q))) wordStarts.push(option);
    else if (n.includes(q)) contains.push(option);
  }
  return [...starts, ...wordStarts, ...contains].slice(0, RESULTS_COUNT);
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = normalize(query);
  if (!q) return <>{text}</>;
  // normalize() can change string length for some characters, so only
  // highlight when the lengths still line up.
  const normalized = normalize(text);
  const index = normalized.indexOf(q);
  if (index === -1 || normalized.length !== text.length) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <span className="text-[#0F6E56]">{text.slice(index, index + q.length)}</span>
      {text.slice(index + q.length)}
    </>
  );
}

type LocationSearchProps = {
  /** The committed place (what gets sent to the API). */
  value: string;
  /** Called with the chosen place. Empty string = "anywhere". */
  onChange: (value: string) => void;
  options: string[];
  loading?: boolean;
  /**
   * "live": onChange fires on every keystroke (good when the parent only
   * reads the value on submit). "explicit": onChange fires only when a
   * suggestion is picked, Enter is pressed or the field is cleared (good
   * when every change triggers a request).
   */
  commit?: 'live' | 'explicit';
  className?: string;
  inputClassName?: string;
  'data-testid'?: string;
};

export function LocationSearch({
  value,
  onChange,
  options,
  loading = false,
  commit = 'live',
  className,
  inputClassName,
  'data-testid': testId,
}: LocationSearchProps) {
  const { t } = useLanguage();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Keep the visible text in sync when the parent changes the value
  // (e.g. "clear filters" or a zone coming from the URL).
  // The trim() check keeps trailing spaces the user is still typing.
  useEffect(() => {
    setQuery((current) => (current.trim() === value ? current : value));
  }, [value]);

  const suggestions = useMemo(() => {
    // Right after picking a place, show the suggested list again instead of
    // a single row that just repeats what's in the input.
    const q = options.includes(query) ? '' : query;
    return rank(options, q);
  }, [options, query]);

  const showingSuggested = !query.trim() || options.includes(query);

  // Close when clicking/tapping outside.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the highlighted row visible while moving with the arrow keys.
  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const select = (place: string) => {
    setQuery(place);
    onChange(place);
    setOpen(false);
    setActive(-1);
  };

  const clear = () => {
    setQuery('');
    onChange('');
    setActive(-1);
    inputRef.current?.focus();
    setOpen(true);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        setActive((i) => (suggestions.length ? (i + 1) % suggestions.length : -1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        setActive((i) => (suggestions.length ? (i <= 0 ? suggestions.length - 1 : i - 1) : -1));
        break;
      case 'Enter':
        if (open && active >= 0 && suggestions[active]) {
          // Pick the highlighted suggestion instead of submitting the form.
          event.preventDefault();
          select(suggestions[active]);
        } else {
          if (commit === 'explicit') onChange(query.trim());
          setOpen(false);
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
          setActive(-1);
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div className="flex min-h-12 items-center gap-2 rounded-xl bg-[#F1EFE8] px-3 text-[#527067] focus-within:ring-2 focus-within:ring-[#0F6E56]/40">
        <MapPin size={18} className="shrink-0 text-[#0F6E56]" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-label={t('searchBar.where')}
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder={loading ? '…' : t('searchBar.where')}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            setActive(next.trim() ? 0 : -1);
            if (commit === 'live') onChange(next.trim());
            else if (!next.trim() && value) onChange('');
          }}
          onKeyDown={onKeyDown}
          className={cn(
            'w-full min-w-0 bg-transparent text-sm font-bold text-[#2C2C2A] outline-none placeholder:text-[#82978e]',
            inputClassName,
          )}
          data-testid={testId}
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label={t('searchBar.clear')}
            className="shrink-0 rounded-full p-1 text-[#527067] transition hover:bg-[#d6e7de] hover:text-[#085041]"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-30 w-full min-w-[260px] overflow-hidden rounded-2xl border border-[#d6e7de] bg-white shadow-[var(--shadow-lg)] sm:min-w-[320px]"
          data-testid={testId ? `${testId}-list` : undefined}
        >
          {suggestions.length > 0 && (
            <p className="px-4 pb-1 pt-3 text-xs font-bold text-[#527067]">
              {showingSuggested ? t('searchBar.suggested') : t('searchBar.results')}
            </p>
          )}
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto p-2 pt-1">
            {suggestions.map((place, index) => (
              <li
                key={place}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // mousedown (not click) so the input keeps focus and the
                // pointerdown outside-handler never sees it as "outside".
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(place);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm font-bold text-[#2C2C2A]',
                  index === active && 'bg-[#E1F5EE]',
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E1F5EE] text-[#0F6E56]">
                  <GraduationCap size={18} aria-hidden />
                </span>
                <span className="min-w-0 truncate">
                  <Highlight text={place} query={showingSuggested ? '' : query} />
                </span>
              </li>
            ))}
          </ul>

          {suggestions.length === 0 && (
            <div className="flex items-center gap-3 px-4 py-5 text-sm text-[#527067]">
              <Search size={16} aria-hidden />
              <span>{t('searchBar.noResults')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
