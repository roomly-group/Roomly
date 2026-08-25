export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface overflow-hidden rounded-2xl">
          <div className="skeleton h-48" />
          <div className="space-y-3 p-4">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-5 w-4/5 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
