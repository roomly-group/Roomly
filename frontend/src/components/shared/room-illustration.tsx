import { cn } from '@/lib/utils';

/** Roomly's room scene: a window with open green shutters, a desk and a plant, in brand colours. Decorative. */
export function RoomIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={cn('block h-auto w-full', className)} aria-hidden>
      <rect width="400" height="300" fill="var(--color-mint-mist)" />
      <rect y="232" width="400" height="68" fill="var(--color-mint-wash)" opacity="0.55" />
      <path d="M170 150 L230 150 L290 300 L150 300 Z" fill="var(--color-paper)" opacity="0.45" />
      {/* shutters */}
      <rect x="112" y="40" width="44" height="118" rx="3" fill="var(--color-shutter)" />
      <rect x="244" y="40" width="44" height="118" rx="3" fill="var(--color-shutter)" />
      {[54, 72, 90, 108, 126, 144].map((y) => (
        <g key={y} fill="var(--color-pine)" opacity="0.45">
          <rect x="118" y={y} width="32" height="5" rx="1" />
          <rect x="250" y={y} width="32" height="5" rx="1" />
        </g>
      ))}
      {/* window */}
      <rect x="160" y="36" width="80" height="120" rx="6" fill="var(--color-pine)" />
      <rect x="168" y="44" width="30" height="50" rx="2" fill="var(--color-paper)" />
      <rect x="202" y="44" width="30" height="50" rx="2" fill="var(--color-paper)" />
      <rect x="168" y="98" width="30" height="50" rx="2" fill="var(--color-paper)" />
      <rect x="202" y="98" width="30" height="50" rx="2" fill="var(--color-paper)" />
      <rect x="150" y="154" width="100" height="10" rx="3" fill="var(--color-pine)" />
      {/* desk */}
      <rect x="60" y="196" width="128" height="10" rx="3" fill="var(--color-pine)" />
      <rect x="70" y="206" width="6" height="60" fill="var(--color-pine)" />
      <rect x="172" y="206" width="6" height="60" fill="var(--color-pine)" />
      <rect x="86" y="174" width="40" height="22" rx="3" fill="var(--color-shutter)" />
      {/* plant */}
      <path d="M318 214 C 314 190, 300 180, 296 168 M318 214 C 320 190, 334 178, 340 166 M318 214 L 318 176" stroke="var(--color-shutter)" strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="302" y="212" width="32" height="30" rx="4" fill="var(--color-shutter)" />
    </svg>
  );
}

export default RoomIllustration;
