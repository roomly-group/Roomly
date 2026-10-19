import { cn } from '@/lib/utils';

/**
 * Page head: the one page title on the left, an optional lede under it, and
 * page actions on the title's last baseline at the right. No kicker.
 */
export function PageIntro({
  title,
  lede,
  action,
  size = 'page',
  className,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  action?: React.ReactNode;
  /** "display" for home and the waitlist; "page" for working screens. */
  size?: 'display' | 'page';
  className?: string;
}) {
  return (
    <div className={cn('mb-10 grid gap-6 lg:grid-cols-12 lg:items-end', className)}>
      <div className="min-w-0 lg:col-span-8">
        <h1
          className={cn(
            'display-heading text-pine',
            size === 'display' ? 'text-[clamp(2.75rem,6vw,4.25rem)]' : 'text-[clamp(2.25rem,4.4vw,3.25rem)]',
          )}
        >
          {title}
        </h1>
        {lede && <p className="mt-4 max-w-xl text-[19px] leading-[1.55] text-pine-text">{lede}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-3 lg:col-span-4 lg:justify-end">{action}</div>}
    </div>
  );
}
