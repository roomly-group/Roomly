import { LISTING_GRID_CLASS } from '@/lib/constants';

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className={LISTING_GRID_CLASS} aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>
          <div className="skeleton aspect-[4/3] rounded-sheet" />
          <div className="mt-3 flex justify-between gap-3">
            <div className="skeleton h-4 w-3/5 rounded-sheet" />
            <div className="skeleton h-4 w-14 rounded-sheet" />
          </div>
          <div className="skeleton mt-2 h-3.5 w-2/3 rounded-sheet" />
          <div className="skeleton mt-2 h-3.5 w-1/3 rounded-sheet" />
        </div>
      ))}
    </div>
  );
}
