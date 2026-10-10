import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/layout/app-shell';
import { LoadingCards } from '@/components/shared/loading-cards';
import { QueryError } from '@/components/shared/query-error';
import { EmptyState } from '@/components/shared/empty-state';
import { MapPin, Star, Wifi } from 'lucide-react';
import { getRoom } from '@/lib/rooms';

export function RoomDetailPage() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const roomId = Number(id);

  const [room, setRoom] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRoom() {
      if (isNaN(roomId)) {
        setError('Invalid room ID');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const roomData = await getRoom(roomId);
        if (roomData === null) {
          setError('Room not found or not available');
        } else {
          setRoom(roomData);
        }
      } catch (err) {
        console.error('Failed to load room:', err);
        setError('Failed to load room. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    loadRoom();
  }, [roomId, t]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12">
          <LoadingCards />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12">
          <QueryError onRetry={() => {
            setLoading(true);
            setError(null);
          }} />
        </div>
      </AppShell>
    );
  }

  if (!room) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12">
          <EmptyState
            title="Room not found"
            text="The room you requested is no longer available."
            action={
              <Link
                href="/rooms"
                className="text-sm font-black text-[#0F6E56]"
                data-testid="link-back-to-rooms"
              >
                Back to rooms
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  // Determine cover photo: first photo with copertina true, or first photo
  const coverPhoto = room.photos.find((p: any) => p.isCover) ?? room.photos[0];
  const galleryPhotos = room.photos.map((p: any) => p.url);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12">
        <div className="mb-6 flex items-center gap-2">
          <Link
            href="/rooms"
            className="text-sm font-black text-[#0F6E56]"
            data-testid="link-back-to-rooms"
          >
            Back to rooms
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="display-heading text-3xl text-[#085041] sm:text-4xl">
            {room.title}
          </h1>
          <div className="mb-4 flex items-center gap-2 text-sm font-black text-[#085041]">
            <span className="flex items-center gap-1">
              <MapPin size={13} /> {room.zone}
              {room.distanceKm !== undefined && room.distanceKm !== null && ` · ${room.distanceKm.toFixed(1)} km`}
            </span>
            <span className="flex items-center gap-1">
              <Star size={14} fill="#EF9F27" className="text-[#EF9F27]" />
              {room.rating?.toFixed(1) ?? '0'}
            </span>
            <span className="flex items-center gap-1">
              Price {t('common.perMonth')}
              <span className="font-bold">€ {Number(room.price).toLocaleString()}</span>
            </span>
          </div>
        </div>

        {/* Photo Gallery */}
        <div className="mb-6">
          <h2 className="mb-2 text-xl font-black text-[#085041]">Photos</h2>
          {galleryPhotos.length === 0 ? (
            <div className="flex aspect-video w-full items-center justify-center bg-gray-200 text-gray-500">
              No photos available
            </div>
          ) : (
            <div className="relative">
              <img
                src={coverPhoto?.url ?? ''}
                alt={room.title}
                crossOrigin="anonymous"
                className="h-[300px] w-full rounded-lg object-cover"
              />
              {galleryPhotos.length > 1 && (
                <div className="mt-4 flex gap-2 overflow-x-auto">
                  {galleryPhotos.map((url: string, idx: number) => (
                    <img
                      key={url}
                      src={url}
                      alt={`${room.title} ${idx + 1}`}
                      crossOrigin="anonymous"
                      className={`h-20 w-20 rounded object-cover ${
                        url === coverPhoto?.url ? 'ring-2 ring-[#0F6E56]' : ''
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {room.description && (
          <div className="mb-6">
            <h2 className="mb-2 text-xl font-black text-[#085041]">Description</h2>
            <p className="text-base leading-7 text-[#527067]">
              {room.description}
            </p>
          </div>
        )}

        {/* Services and House Rules */}
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 text-xl font-black text-[#085041]">Services</h2>
            {room.servizi.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {room.servizi.map((service: string) => (
                  <span
                    key={service}
                    className="px-3 py-1 bg-[#E1F5EE] text-sm font-medium text-[#085041] rounded"
                  >
                    {service}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#527067]">No services listed</p>
            )}
          </div>
          <div>
            <h2 className="mb-2 text-xl font-black text-[#085041]">House rules</h2>
            <div className="space-y-2">
              <p className="flex items-center gap-2">
                <MapPin size={14} /> {t('common.availableNow')}
              </p>
              <p className="flex items-center gap-2">
                <Star size={14} fill="#EF9F27" className="text-[#EF9F27]" /> {t('common.furnished')}
              </p>
              <p className="flex items-center gap-2">
                <Wifi size={14} /> Wi‑Fi
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={14} /> Pets allowed
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={14} /> Smoking allowed
              </p>
            </div>
          </div>
        </div>

        {/* Owner Info */}
        {room.ownerName && (
          <div className="mb-6">
            <h2 className="mb-2 text-xl font-black text-[#085041]">Owner info</h2>
            <div className="flex items-center gap-4">
              {room.ownerAvatarUrl ? (
                <img
                  src={room.ownerAvatarUrl}
                  alt={room.ownerName}
                  className="w-16 h-16 rounded-full"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-[#085041]">
                  ?
                </div>
              )}
              <div>
                <h3 className="font-bold text-[#085041]">{room.ownerName}</h3>
                {room.ownerBio && (
                  <p className="mt-1 text-sm leading-5 text-[#527067]">
                    {room.ownerBio}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}