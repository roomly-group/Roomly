import { useLanguage } from '@/lib/i18n';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

// ===================== CONFIGURATION =====================

/** Distance written on the example route (km) — an illustration, labelled "Esempio". */
export const EXAMPLE_KM = 0.8 as const;

/** Built blocks of the illustrative plan: [x, y, width, height, rotation]. */
const BLOCKS: readonly [number, number, number, number, number][] = [
  [24, 26, 70, 46, -4], [104, 20, 58, 52, -4], [172, 16, 76, 50, -4], [258, 12, 64, 54, -4],
  [20, 84, 62, 58, -4], [92, 82, 74, 40, -4], [176, 78, 52, 62, -4], [238, 76, 84, 44, -4],
  [348, 36, 70, 44, 6], [428, 46, 64, 56, 6], [340, 92, 58, 60, 6], [408, 112, 80, 44, 6],
  [30, 268, 66, 52, 3], [106, 262, 82, 46, 3], [198, 270, 60, 58, 3], [24, 330, 78, 60, 3],
  [112, 322, 56, 70, 3], [178, 340, 78, 50, 3], [336, 250, 70, 50, -6], [416, 238, 76, 62, -6],
  [330, 312, 88, 46, -6], [428, 312, 62, 70, -6], [274, 352, 50, 50, -6],
];

/**
 * An illustrative pocket city plan in the brand palette: blocks, a river,
 * parks, a campus and a room joined by the tratta. Always labelled as an
 * example — it does not show real listings.
 */
export function CityPlan({ variant = 'route', className }: { variant?: 'route' | 'lost'; className?: string }) {
  const { t } = useLanguage();
  const format = useFormat();
  return (
    <figure className={cn('relative overflow-hidden rounded-sheet border border-hairline bg-ground', className)}>
      <svg
        viewBox="0 0 520 420"
        className="block h-auto w-full"
        {...(variant === 'route' ? { role: 'img', 'aria-label': t('waitlist.planLabel') } : { 'aria-hidden': true })}
      >
        <rect width="520" height="420" fill="var(--color-paper)" />
        {/* River */}
        <path
          d="M-10 196 C 90 168, 150 236, 250 214 S 410 166, 530 206"
          fill="none"
          stroke="var(--color-mint-wash)"
          strokeWidth="26"
          strokeLinecap="round"
          opacity="0.7"
        />
        {/* Parks */}
        <path d="M300 128 L338 120 L346 168 L304 176 Z" fill="var(--color-mint-mist)" stroke="var(--color-mint-wash)" strokeWidth="1.5" />
        <path d="M232 300 L262 296 L268 336 L238 342 Z" fill="var(--color-mint-mist)" stroke="var(--color-mint-wash)" strokeWidth="1.5" />
        {/* Built blocks */}
        {BLOCKS.map(([x, y, w, h, r]) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={w}
            height={h}
            rx="3"
            transform={`rotate(${r} ${x + w / 2} ${y + h / 2})`}
            fill="var(--color-terracotta-mist)"
            stroke="var(--color-terracotta)"
            strokeOpacity="0.22"
          />
        ))}
        {/* Main avenue */}
        <path d="M-10 250 L 530 150" stroke="var(--color-paper)" strokeWidth="14" />
        <path d="M-10 250 L 530 150" stroke="var(--color-outline)" strokeWidth="1" strokeDasharray="2 6" />
        {/* Bridge */}
        <rect x="244" y="190" width="14" height="44" fill="var(--color-paper)" stroke="var(--color-outline)" transform="rotate(-10 251 212)" />

        {variant === 'route' ? (
          <>
            {/* La tratta: room → campus */}
            <path
              d="M118 300 L 160 286 L 222 242 L 300 226 L 374 274"
              fill="none"
              stroke="var(--color-shutter)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="tratta-draw"
              style={{ '--tratta-length': '330' } as React.CSSProperties}
            />
            <circle cx="118" cy="300" r="9" fill="var(--color-ground)" stroke="var(--color-shutter)" strokeWidth="4" />
            <rect x="364" y="264" width="20" height="20" fill="var(--color-pine)" />
            <g style={{ font: '800 11px var(--app-font-sans)', letterSpacing: '0.08em' }}>
              <rect x="40" y="310" width="120" height="22" rx="3" fill="var(--color-paper)" />
              <text x="48" y="325" fill="var(--color-pine)">{t('waitlist.planRoom')}</text>
              <rect x="352" y="290" width="122" height="22" rx="3" fill="var(--color-pine)" />
              <text x="360" y="305" fill="var(--color-mint-mist)">{t('waitlist.planCampus')}</text>
            </g>
            <g>
              <rect x="226" y="248" width="72" height="28" rx="3" fill="var(--color-shutter)" />
              <text x="262" y="267" textAnchor="middle" fill="var(--color-mint-mist)" style={{ font: '900 15px var(--app-font-sans)' }}>
                {format.km(EXAMPLE_KM)} km
              </text>
            </g>
          </>
        ) : (
          <>
            <path
              d="M118 300 L 160 286 L 222 242 L 262 236"
              fill="none"
              stroke="var(--color-shutter)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="2 10"
            />
            <circle cx="118" cy="300" r="9" fill="var(--color-ground)" stroke="var(--color-shutter)" strokeWidth="4" />
            <circle cx="282" cy="232" r="18" fill="var(--color-pine)" />
            <text x="282" y="240" textAnchor="middle" fill="var(--color-mint-mist)" style={{ font: '900 22px var(--app-font-sans)' }}>
              ?
            </text>
          </>
        )}

        {/* Scale bar */}
        <g style={{ font: '800 10px var(--app-font-sans)', letterSpacing: '0.08em' }} fill="var(--color-sage)">
          <rect x="24" y="398" width="40" height="4" fill="var(--color-pine)" />
          <rect x="64" y="398" width="40" height="4" fill="var(--color-paper)" stroke="var(--color-pine)" strokeWidth="1" />
          <text x="24" y="392">0</text>
          <text x="104" y="392" textAnchor="end">500 M</text>
        </g>
      </svg>
      {variant === 'route' && (
        <figcaption className="absolute right-3 top-3 rounded-sheet bg-pine px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-mint-mist">
          {t('waitlist.exampleLabel')}
        </figcaption>
      )}
    </figure>
  );
}
