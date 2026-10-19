import { ImageOff } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// ===================== CONFIGURATION =====================

/** Slats drawn on each shutter leaf. */
const SLAT_COUNT = 11 as const;

/**
 * The no-photo placeholder: a closed green shutter (persiana), the brand's
 * own object, drawn in SVG. It says honestly that photos are missing.
 */
export function Persiana({ className, showLabel = true }: { className?: string; showLabel?: boolean }) {
  const { t } = useLanguage();
  const slats = Array.from({ length: SLAT_COUNT }, (_, index) => 6 + index * (88 / SLAT_COUNT));
  return (
    <div className={cn('relative overflow-hidden bg-pine', className)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full">
        <rect x="0" y="0" width="100" height="100" fill="var(--color-pine)" />
        {[3, 51].map((leftEdge) => (
          <g key={leftEdge}>
            <rect x={leftEdge} y="3" width="46" height="94" fill="var(--color-shutter)" />
            {slats.map((y) => (
              <g key={y}>
                <rect x={leftEdge + 3} y={y} width="40" height={88 / SLAT_COUNT - 2.2} fill="var(--color-shutter-hover)" />
                <rect x={leftEdge + 3} y={y} width="40" height="0.8" fill="var(--color-mint-wash)" opacity="0.35" />
              </g>
            ))}
          </g>
        ))}
      </svg>
      {showLabel && (
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-sheet bg-chip-veil px-2.5 py-1.5 text-xs font-extrabold text-pine">
          <ImageOff size={13} aria-hidden /> {t('common.noPhotos')}
        </span>
      )}
    </div>
  );
}
