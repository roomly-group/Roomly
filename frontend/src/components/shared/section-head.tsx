import { cn } from '@/lib/utils';

/** Section title, a hairline running to the container's edge, and an optional link at the end of the line. */
export function SectionHead({
  title,
  id,
  action,
  className,
}: {
  title: React.ReactNode;
  id?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      <h2
        id={id}
        className={cn(
          'min-w-0 text-[clamp(1.5rem,2.6vw,1.875rem)] font-black leading-[1.05] tracking-[-0.035em] text-pine',
          action && 'max-sm:basis-full',
        )}
      >
        {title}
      </h2>
      {/* On phones a titled row with an action stacks: title, then the action; the rule only runs when they share a line. */}
      <span aria-hidden className={cn('h-px min-w-6 flex-1 bg-line', action && 'max-sm:hidden')} />
      {action}
    </div>
  );
}
