import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

// One-tap answers for the onboarding. Each option is a native radio input
// (visually hidden) inside its label, so arrow keys, focus and screen readers
// behave like any radio group without extra code.

type ChoiceProps = {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
  testId?: string;
};

/**
 * Card with an icon and a label ("Come ci hai scoperto?"). Phones: a compact
 * row (icon left of the label), so all eight answers fit on one screen. From
 * sm: a big square card with the icon above the label.
 */
export function ChoiceCard({ name, value, checked, onSelect, children, icon, testId }: ChoiceProps & { icon: ReactNode }) {
  return (
    <label
      className={`relative flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 active:scale-[0.98] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-shutter motion-reduce:transition-none sm:min-h-[112px] sm:flex-col sm:justify-center sm:px-3 sm:py-5 sm:text-center ${
        checked
          ? 'border-shutter bg-mint-mist shadow-[inset_0_0_0_1px_var(--color-shutter)]'
          : 'border-hairline bg-paper shadow-rest hover:border-outline hover:shadow-lift'
      }`}
      data-testid={testId}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      {checked ? (
        <span className="absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-shutter text-mint-mist sm:right-2.5 sm:top-2.5 sm:translate-y-0" aria-hidden>
          <Check size={13} strokeWidth={3} />
        </span>
      ) : null}
      <span className="grid h-7 w-7 shrink-0 place-items-center text-pine" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 pr-4 text-sm font-extrabold text-ink sm:pr-0">{children}</span>
    </label>
  );
}

/** Compact pill for short answers (months, budget, habits). */
export function ChoiceChip({ name, value, checked, onSelect, children, testId }: ChoiceProps) {
  return (
    <label
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-extrabold transition-[border-color,background-color,color] duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-shutter motion-reduce:transition-none ${
        checked
          ? 'border-shutter bg-shutter text-mint-mist'
          : 'border-field bg-paper text-pine hover:border-shutter hover:bg-mint-mist'
      }`}
      data-testid={testId}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      {checked ? <Check size={14} strokeWidth={3} aria-hidden /> : null}
      {children}
    </label>
  );
}

/**
 * A labelled group of chips: the legend is the question, the chips the answers.
 * `columns`: on phones the chips sit in two even columns instead of ragged
 * rows (long lists like the arrival months); from sm they wrap freely again.
 */
export function ChipGroup({ legend, children, columns = false }: { legend: string; children: ReactNode; columns?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-extrabold text-pine">{legend}</legend>
      <div className={columns ? 'grid grid-cols-2 gap-2 sm:flex sm:flex-wrap' : 'flex flex-wrap gap-2'}>{children}</div>
    </fieldset>
  );
}
