import { LISTING_GRID_CLASS, PC_ONLY_CARD_CLASS } from '@/lib/constants';

/**
 * Skeleton grid shown while listings load.
 * `pcOnlyFrom`: skeletons from this index on only show on PCs, so the
 * placeholder matches a grid that shows fewer cards on phones and tablets.
 * `gridClassName`: lets a page reuse its own grid layout for the skeletons.
 */
export function LoadingCards({
  count = 4,
  pcOnlyFrom,
  gridClassName = LISTING_GRID_CLASS,
}: {
  count?: number;
  pcOnlyFrom?: number;
  gridClassName?: string;
}) {
  return (
    <div className={gridClassName} aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={pcOnlyFrom !== undefined && index >= pcOnlyFrom ? PC_ONLY_CARD_CLASS : undefined}
        >
          <div className="skeleton aspect-[4/3] rounded-[20px] sm:aspect-[20/19] sm:rounded-2xl" />
          <div className="mt-3 space-y-2">
            <div className="skeleton h-4 w-4/5 rounded" />
            <div className="skeleton h-3.5 w-3/5 rounded" />
            <div className="skeleton h-3.5 w-2/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
