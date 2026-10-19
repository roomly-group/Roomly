import { LISTING_GRID_CLASS } from '@/lib/constants';

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className={LISTING_GRID_CLASS} aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>
          <div className="skeleton aspect-[20/19] rounded-2xl" />
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
