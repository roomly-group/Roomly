import { supabase } from './supabase';

export interface RoomFilters {
  universityId?: string;
  city?: string;
  maxPrice?: number;
}

export interface RoomListOptions extends RoomFilters {
  page?: number;
  pageSize?: number;
}

export interface Room {
  id: number;
  title: string;
  description: string;
  price: number;
  zone: string;
  universityName?: string;
  latitude?: number | null;
  longitude?: number | null;
  servizi: string[];
  attiva: boolean;
  stato: string;
  universita_id?: string | null;
  proprietario_id: string;
  // For room list, we might want:
  coverPhotoUrl?: string;
  photoCount?: number;
  photos: { url: string; isCover: boolean }[];
  distanceKm?: number;
  // Owner info (for detail page)
  ownerName?: string;
  ownerAvatarUrl?: string;
  ownerBio?: string;
}

async function fetchListingMedia(): Promise<Map<number, { coverPhotoUrl?: string; photoUrls?: string[]; photos?: number }>> {
  const response = await fetch('/api/listings');
  if (!response.ok) return new Map();
  const listings = await response.json() as Array<{
    id: number;
    coverPhotoUrl?: string;
    photoUrls?: string[];
    photos?: number;
  }>;
  return new Map(listings.map((listing) => [listing.id, listing]));
}

/**
 * Fetch a list of rooms with optional filters and pagination.
 */
export async function listRooms(options: RoomListOptions = {}) {
  const {
    universityId,
    city,
    maxPrice,
    page = 1,
    pageSize = 20,
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('stanze')
    .select(`
      id,
      titolo,
      prezzo,
      descrizione,
      attiva,
      stato,
      servizi,
      universita_id,
      proprietario_id,
      latitudine,
      longitudine,
      universita:universita_id(nome),
      stanze_foto(url, copertina, ordine)
    `)
    .eq('attiva', true)
    .eq('stato', 'disponibile');

  if (universityId) {
    query = query.eq('universita_id', universityId);
  }

  if (city) {
    query = query.eq('citta', city);
  }

  if (maxPrice !== undefined) {
    query = query.lte('prezzo', maxPrice);
  }

  const { data, error } = await query.range(from, to).order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const listingMedia = await fetchListingMedia();

  // Process the data to flatten photos and compute cover photo
  const rooms: Room[] = (data ?? []).map((room: any) => {
    const foto = room.stanze_foto ?? [];
    const coverFoto = foto.find((f: any) => f.copertina) ?? foto[0];
    const coverPhotoUrl = listingMedia.get(room.id)?.coverPhotoUrl;
    const university = Array.isArray(room.universita) ? room.universita[0] : room.universita;

    return {
      id: room.id,
      title: room.titolo ?? '',
      description: room.descrizione ?? '',
      price: Number(room.prezzo ?? 0),
      zone: university?.nome ?? '',
      universityName: university?.nome ?? null,
      latitude: room.latitudine,
      longitude: room.longitudine,
      servizi: Array.isArray(room.servizi) ? room.servizi : [],
      attiva: room.attiva,
      stato: room.stato ?? '',
      universita_id: room.universita_id,
      proprietario_id: room.proprietario_id,
      coverPhotoUrl,
      photoCount: listingMedia.get(room.id)?.photos ?? foto.length,
      photos: foto.map((f: any) => ({
        url: f.url,
        isCover: f.copertina,
      })),
    };
  });

  return rooms;
}

/**
 * Fetch a single room by ID with photos and owner info.
 */
export async function getRoom(id: number): Promise<Room | null> {
  // Fetch room basic info
  const { data: roomData, error: roomError } = await supabase
    .from('stanze')
    .select(`
      id,
      titolo,
      prezzo,
      descrizione,
      attiva,
      stato,
      servizi,
      universita_id,
      latitudine,
      longitudine,
      universita:universita_id(nome),
      proprietario_id
    `)
    .eq('id', id)
    .eq('attiva', true)
    .eq('stato', 'disponibile')
    .single();

  if (roomError) {
    if (roomError.code === 'PGRST116') {
      // No rows found
      return null;
    }
    throw roomError;
  }

  if (!roomData) {
    return null;
  }

  // Fetch photos for this room
  const { data: fotoData, error: fotoError } = await supabase
    .from('stanze_foto')
    .select('url, copertina, ordine')
    .eq('stanza_id', id)
    .order('ordine', { ascending: true });

  if (fotoError) {
    throw fotoError;
  }

  // Fetch owner info from the public view
  const { data: ownerData, error: ownerError } = await supabase
    .from('proprietari_pubblici')
    .select('nome, foto_profilo, bio')
    .eq('id', roomData.proprietario_id)
    .single();

  if (ownerError && ownerError.code !== 'PGRST116') {
    // If the view doesn't have the owner, we still want to return the room without owner info
    console.warn('Failed to fetch owner info:', ownerError);
  }

  const listingResponse = await fetch(`/api/listings/${id}`);
  const listingMedia = listingResponse.ok
    ? await listingResponse.json() as { coverPhotoUrl?: string; photoUrls?: string[] }
    : {};
  const coverPhotoUrl = listingMedia.coverPhotoUrl ?? undefined;
  const university = Array.isArray(roomData.universita) ? roomData.universita[0] : roomData.universita;

  const room: Room = {
    id: roomData.id,
    title: roomData.titolo ?? '',
    description: roomData.descrizione ?? '',
    price: Number(roomData.prezzo ?? 0),
    zone: university?.nome ?? '',
    universityName: university?.nome ?? null,
    latitude: roomData.latitudine,
    longitude: roomData.longitudine,
    servizi: Array.isArray(roomData.servizi) ? roomData.servizi : [],
    attiva: roomData.attiva,
    stato: roomData.stato ?? '',
    universita_id: roomData.universita_id,
    proprietario_id: roomData.proprietario_id,
    coverPhotoUrl,
    photoCount: (fotoData ?? []).length,
    photos: (fotoData ?? []).flatMap((photo: any, index: number) => {
      const url = listingMedia.photoUrls?.[index];
      return url ? [{ url, isCover: photo.copertina }] : [];
    }),
    ownerName: ownerData?.nome ?? null,
    ownerAvatarUrl: ownerData?.foto_profilo ?? null,
    ownerBio: ownerData?.bio ?? null,
  };

  return room;
}

/**
 * Fetch nearby rooms using the stanze_vicine RPC.
 */
export async function listNearbyRooms(universityId: string, radiusKm: number): Promise<Room[]> {
  // Call the RPC
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('stanze_vicine', { uni_id: universityId, raggio_km: radiusKm });

  if (rpcError) {
    throw rpcError;
  }

  const roomIds = (rpcData ?? []).map((row: any) => row.id);

  if (roomIds.length === 0) {
    return [];
  }

  // Fetch full room data for these IDs, preserving the order from the RPC
  const { data: roomsData, error: roomsError } = await supabase
    .from('stanze')
    .select(`
      id,
      titolo,
      prezzo,
      descrizione,
      attiva,
      stato,
      servizi,
      universita_id,
      proprietario_id,
      latitudine,
      longitudine,
      universita:universita_id(nome),
      stanze_foto(url, copertina, ordine)
    `)
    .in('id', roomIds)
    .eq('attiva', true)
    .eq('stato', 'disponibile');

  if (roomsError) {
    throw roomsError;
  }

  const listingMedia = await fetchListingMedia();

  // Map the rooms and add distance from the RPC data
  const roomsMap = new Map<number, number>();
  (rpcData ?? []).forEach((row: any) => {
    const distance = Number(row.distanza_km);
    if (!isNaN(distance)) {
      roomsMap.set(row.id, distance);
    }
  });

  const rooms: Room[] = (roomsData ?? []).map((room: any) => {
    const foto = room.stanze_foto ?? [];
    const coverPhotoUrl = listingMedia.get(room.id)?.coverPhotoUrl;
    const university = Array.isArray(room.universita) ? room.universita[0] : room.universita;

    const distance = roomsMap.get(room.id);

    return {
      id: room.id,
      title: room.titolo ?? '',
      description: room.descrizione ?? '',
      price: Number(room.prezzo ?? 0),
      zone: university?.nome ?? '',
      universityName: university?.nome ?? null,
      latitude: room.latitudine,
      longitude: room.longitudine,
      servizi: Array.isArray(room.servizi) ? room.servizi : [],
      attiva: room.attiva,
      stato: room.stato ?? '',
      universita_id: room.universita_id,
      proprietario_id: room.proprietario_id,
      coverPhotoUrl,
      photoCount: listingMedia.get(room.id)?.photos ?? foto.length,
      photos: coverPhotoUrl ? [{ url: coverPhotoUrl, isCover: true }] : [],
      distanceKm: distance,
    };
  });

  // Sort by distance (closest first)
  rooms.sort((a, b) => {
    if (a.distanceKm === undefined && b.distanceKm === undefined) return 0;
    if (a.distanceKm === undefined) return 1;
    if (b.distanceKm === undefined) return -1;
    return a.distanceKm - b.distanceKm;
  });

  return rooms;
}

/**
 * Fetch a list of university names for the dropdown.
 */
export async function listUniversities(): Promise<string[]> {
  const { data, error } = await supabase
    .from('universita')
    .select('nome')
    .order('nome');

  if (error) {
    throw error;
  }

  return (data ?? []).map((uni: any) => uni.nome);
}