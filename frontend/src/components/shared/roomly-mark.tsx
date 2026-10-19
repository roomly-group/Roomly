import roomlyMark from '@assets/logo_no_background.png';
import { cn } from '@/lib/utils';

/**
 * The official Roomly mark, recoloured through a CSS mask so it reads on the
 * pine band (mint) or on paper (pine) without a second asset.
 */
export function RoomlyMark({ className, tone = 'mint' }: { className?: string; tone?: 'mint' | 'pine' }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0', tone === 'mint' ? 'bg-mint-mist' : 'bg-pine', className)}
      style={{
        maskImage: `url(${roomlyMark})`,
        WebkitMaskImage: `url(${roomlyMark})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  );
}
