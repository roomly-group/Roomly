import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/shared/button';
import { LocationSearch } from '@/components/shared/location-search';
import { ListingCard } from '@/components/shared/listing-card';
import { LoadingCards } from '@/components/shared/loading-cards';
import { QueryError } from '@/components/shared/query-error';
import { EmptyState } from '@/components/shared/empty-state';
import { listRooms, listUniversities, RoomFilters } from '@/lib/rooms';

export function RoomsPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [universities, setUniversities] = useState<string[]>([]);
  const [universityId, setUniversityId] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [radius, setRadius] = useState<string>(''); // in km
  const [page, setPage] = useState<number>(1);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Fetch universities for dropdown
  useEffect(() => {
    async function loadUniversities() {
      try {
        const unis = await listUniversities();
        setUniversities(unis);
      } catch (err) {
        console.error('Failed to load universities:', err);
        // Non-critical, continue without universities
      }
    }
    loadUniversities();
  }, []);

  // Fetch rooms when filters or page change
  const loadRooms = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const filters: RoomFilters = {};
      if (universityId) filters.universityId = universityId;
      if (maxPrice) filters.maxPrice = parseFloat(maxPrice);

      let newRooms;
      if (radius && universityId) {
        const radiusValue = Number(radius);
        if (!Number.isNaN(radiusValue) && radiusValue > 0) {
          newRooms = await import('@/lib/rooms').then(({ listNearbyRooms }) =>
            listNearbyRooms(universityId, radiusValue),
          );
        } else {
          newRooms = await listRooms({ ...filters, page, pageSize: 10 });
        }
      } else {
        newRooms = await listRooms({ ...filters, page, pageSize: 10 });
      }

      setRooms(prev => (page === 1 ? newRooms : [...prev, ...newRooms]));
      setHasMore(newRooms.length === 10);
    } catch (err) {
      console.error('Failed to load rooms:', err);
      setError('Failed to load rooms. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [universityId, maxPrice, radius, page, loading]);

  useEffect(() => {
    // Reset rooms when filters change
    setRooms([]);
    setPage(1);
    setHasMore(true);
    loadRooms();
  }, [universityId, maxPrice, loadRooms]);

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  const resetFilters = () => {
    setUniversityId('');
    setMaxPrice('');
    setRadius('');
    setPage(1);
    setRooms([]);
    setHasMore(true);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12">
        <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-[#E1F5EE] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm font-extrabold text-[#085041]">
            <span>
              {rooms.length} {rooms.length === 1 ? t('common.room') : t('common.rooms')} rooms to explore
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LocationSearch
              className="w-full sm:w-72"
              value={universityId}
              onChange={setUniversityId}
              options={universities}
              loading={false} // universities are loaded
              data-testid="input-room-university"
            />

            <label className="flex items-center gap-2 rounded-xl border border-[#bedbcd] bg-[#F1EFE8] px-3 py-2 text-sm font-bold text-[#527067]">
              <span className="font-black">£</span>
              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                type="number"
                placeholder="Max price"
                className="w-16 bg-transparent outline-none"
                data-testid="input-room-max-price"
              />
            </label>

            <button
              onClick={() => {
                setPage(1);
                setRooms([]);
                setHasMore(true);
                void loadRooms();
              }}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-extrabold transition ${
                radius
                  ? 'border-[#0F6E56] bg-[#0F6E56] text-[#E1F5EE]'
                  : 'border-[#bedbcd] bg-[#F1EFE8] text-[#527067]'
              }`}
              data-testid="button-filter-radius"
            >
              {radius ? `${radius} km within` : 'Within'}
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingCards count={6} />
        ) : error ? (
          <QueryError onRetry={() => {
            setPage(1);
            setRooms([]);
            loadMore();
          }} />
        ) : rooms.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => {
              // Map our Room data to the Listing type expected by ListingCard
              const listing = {
                id: room.id,
                title: room.title,
                zone: room.zone,
                price: room.price,
                owner: room.ownerName ?? '',
                rating: 0, // we don't have rating in list
                photos: room.photoCount ?? room.photos.length,
                coverPhotoUrl: room.coverPhotoUrl,
                furnished: room.servizi.some((s: string) => ['arredato', 'mobilio', 'letto', 'armadio'].includes(s.toLowerCase())),
                wifi: room.servizi.some((s: string) => s.toLowerCase().includes('internet')),
                description: room.description,
                available: room.attiva && room.stato === 'disponibile',
                distanceKm: room.distanceKm,
              };
              return <ListingCard key={room.id} listing={listing} />;
            })}
          </div>
        ) : (
          <EmptyState
            title="No rooms match these filters"
            text="Try widening your budget or area to see more rooms."
            action={
              <Button
                variant="secondary"
                onClick={resetFilters}
                data-testid="button-reset-filters"
              >
                Reset
              </Button>
            }
          />
        )}

        {hasMore && !loading && rooms.length > 0 && (
          <div className="mt-6 flex justify-center">
            <Button
              onClick={loadMore}
              className="w-48"
              data-testid="button-load-more"
            >
              Load more
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}