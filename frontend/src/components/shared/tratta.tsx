import { useLanguage } from '@/lib/i18n';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

// ===================== CONFIGURATION =====================

/** Full length of the tratta scale (km): longer distances end in an arrow. */
const TRATTA_SCALE_KM = 5 as const;
/** Scale ticks drawn under the large tratta (km). */
const TRATTA_TICKS_KM = [0, 1, 2, 3, 4, 5] as const;

/**
 * La tratta — Roomly's signature: the distance to a university drawn to
 * scale as a route segment (home ring → line → campus square) on a fixed
 * 0–5 km scale. Only rendered when the backend returned a real distance.
 */
/** Legend entry for the card tratta: the full 0–5 km track, ring to square, and what it means. */
export function TrattaScaleKey({ className }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <p className={cn('inline-flex items-center gap-2 text-[13px] font-bold text-sage', className)}>
      <svg width="64" height="12" viewBox="0 0 64 12" aria-hidden className="shrink-0">
        <line x1="4" y1="6" x2="60" y2="6" stroke="var(--color-shutter)" strokeWidth="2" />
        <circle cx="4" cy="6" r="3" fill="var(--color-paper)" stroke="var(--color-shutter)" strokeWidth="1.5" />
        <rect x="57" y="3" width="6" height="6" fill="var(--color-pine)" />
      </svg>
      {t('home.scaleLegend')}
    </p>
  );
}

export function Tratta({
  km,
  university,
  size = 'sm',
  fromLabel,
  className,
}: {
  km: number;
  university: string;
  size?: 'sm' | 'lg';
  /** lg only: replaces "da {university}", e.g. for a labelled example. */
  fromLabel?: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const format = useFormat();
  const ratio = Math.min(Math.max(km, 0), TRATTA_SCALE_KM) / TRATTA_SCALE_KM;
  const beyond = km > TRATTA_SCALE_KM;
  const kmText = `${format.km(km)} km`;

  if (size === 'sm') {
    // 64px track: the ring at 4, the scale ends at 60.
    const end = 4 + ratio * 56;
    return (
      <p className={cn('flex min-w-0 items-center gap-2 text-sm', className)}>
        <svg width="64" height="12" viewBox="0 0 64 12" aria-hidden className="shrink-0">
          <line x1="4" y1="6" x2="60" y2="6" stroke="var(--color-line)" strokeWidth="2" />
          <line x1="4" y1="6" x2={end} y2="6" stroke="var(--color-shutter)" strokeWidth="2" />
          <circle cx="4" cy="6" r="3" fill="var(--color-paper)" stroke="var(--color-shutter)" strokeWidth="1.5" />
          {beyond ? (
            <path d="M55 2 L61 6 L55 10" fill="none" stroke="var(--color-pine)" strokeWidth="2" />
          ) : (
            <rect x={end - 3} y="3" width="6" height="6" fill="var(--color-pine)" />
          )}
        </svg>
        <span className="shrink-0 font-black tabular-nums text-pine">{kmText}</span>
        <span className="min-w-0 truncate font-bold text-sage">{university}</span>
      </p>
    );
  }

  // Large: a 560-unit track with km ticks; the route draws itself once.
  const x0 = 12;
  const span = 536;
  const end = x0 + ratio * span;
  const length = end - x0;
  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[clamp(3rem,7vw,4.5rem)] font-black leading-none tracking-[-0.05em] tabular-nums text-pine">
          {kmText}
        </span>
        <span className="text-[17px] font-extrabold text-pine">
          {fromLabel ?? t('listingDetail.distanceFrom').replace('{university}', university)}
        </span>
      </figcaption>
      <svg viewBox="0 0 560 44" className="mt-5 block w-full max-w-[560px]" role="img" aria-label={`${kmText} — ${university}`}>
        <line x1={x0} y1="14" x2={x0 + span} y2="14" stroke="var(--color-line)" strokeWidth="3" />
        {TRATTA_TICKS_KM.map((tick) => {
          const x = x0 + (tick / TRATTA_SCALE_KM) * span;
          return (
            <g key={tick}>
              <line x1={x} y1="20" x2={x} y2="26" stroke="var(--color-outline)" strokeWidth="1.5" />
              <text
                x={x}
                y="40"
                textAnchor={tick === 0 ? 'start' : tick === TRATTA_SCALE_KM ? 'end' : 'middle'}
                fill="var(--color-sage)"
                style={{ font: '800 11px var(--app-font-sans)', letterSpacing: '0.08em' }}
              >
                {tick === TRATTA_SCALE_KM ? `${tick} KM` : tick}
              </text>
            </g>
          );
        })}
        {length > 0 && (
          <line
            x1={x0}
            y1="14"
            x2={end}
            y2="14"
            stroke="var(--color-shutter)"
            strokeWidth="3"
            className="tratta-draw"
            style={{ '--tratta-length': `${length}` } as React.CSSProperties}
          />
        )}
        <circle cx={x0} cy="14" r="7" fill="var(--color-ground)" stroke="var(--color-shutter)" strokeWidth="3" />
        {beyond ? (
          <path d={`M${end - 10} 6 L${end} 14 L${end - 10} 22`} fill="none" stroke="var(--color-pine)" strokeWidth="3" />
        ) : (
          <rect x={end - 7} y="7" width="14" height="14" fill="var(--color-pine)" />
        )}
      </svg>
      <p className="mt-2 text-sm text-sage">{t('listingDetail.straightLine')}</p>
    </figure>
  );
}
