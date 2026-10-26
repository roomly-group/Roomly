import { raw, Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { requireAppAccess, requireAuth } from "../middleware/auth";
import { readNearbyPlaces, refreshNearbyPlaces } from "../lib/nearby-places.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { isValidImage, uploadImageType } from "../lib/image.js";
import { signedProfilePhotoUrl } from "../lib/profile-photo.js";
import {
  SEARCH_RADIUS_KM,
  boundingBox,
  haversineKm,
  nearestUniversity,
  type UniversityPoint,
} from "../lib/geo.js";
import {
  type Listing,
  CreateListingBody,
  GetListingParams,
  ListListingsQueryParams,
  CreateListingResponse,
  GetListingResponse,
  ListListingsResponse,
  GetOwnerDashboardResponse,
  ROOM_PHOTO_MAX_COUNT,
  ROOM_PHOTO_MAX_SIZE_BYTES,
  API_ROUTE_PATHS,
  ROOM_FEATURE_COLUMNS,
  ListingApartmentLayoutSchema,
  ListingFeatureGroupsSchema,
  ListingPropertyTypeSchema,
  emptyListingFeatureGroups,
  hasWifiIncluded,
  listingFeaturesToRoomColumns,
  roomColumnsToListingFeatures,
  type RoomFeatureColumns,
} from "@workspace/api-zod";

// ===================== CONFIGURATION =====================

/** Supabase storage bucket used for listing-room photos. */
const ROOM_PHOTO_BUCKET = "foto_stanze" as const;
/** Lifetime of generated signed room-photo URLs (seconds). */
const ROOM_PHOTO_URL_TTL_SECONDS = 3600 as const;
/** Maximum university matches retrieved for zone resolution (records). */
const UNIVERSITY_MATCH_LIMIT = 10 as const;
/** Cache lifetime used for uploaded room photos (seconds, string required by storage API). */
const ROOM_PHOTO_CACHE_CONTROL_MAX_AGE_SECONDS = "31536000" as const;
/** Coordinate change tolerance used when deciding whether to update a listing location (degrees). */
const COORDINATE_CHANGE_TOLERANCE_DEGREES = 0.000001 as const;

type RoomRow = {
  id: number;
  titolo: string | null;
  prezzo: number | string | null;
  descrizione?: string | null;
  attiva?: boolean | null;
  stato?: string | null;
  proprietario_id?: string | null;
  universita_id?: string | number | null;
  latitudine?: number | null;
  longitudine?: number | null;
  stanze_foto?: Array<{ url?: string | null; copertina?: boolean | null; ordine?: number | null }> | null;
  universita?: { nome?: string | null; latitudine?: number | null; longitudine?: number | null } | null;
  utenti?: { nome_utente?: string | null; nome?: string | null; cognome?: string | null; foto_profilo?: string | null } | null;
} & Partial<RoomFeatureColumns>; // tipologia_proprieta, taglio_appartamento, mobili_inclusi, spese_incluse, elettrodomestici, arredi, servizi...

const router: IRouter = Router();

const getRoomPhotoPath = (storedUrl: string): string | null => {
  const markers = [
    `/object/public/${ROOM_PHOTO_BUCKET}/`,
    `/object/sign/${ROOM_PHOTO_BUCKET}/`,
  ];
  const marker = markers.find((candidate) => storedUrl.includes(candidate));
  if (!marker) return storedUrl.startsWith("http") ? null : storedUrl;

  try {
    return decodeURIComponent(storedUrl.slice(storedUrl.indexOf(marker) + marker.length).split("?", 1)[0]);
  } catch {
    return null;
  }
};

const createRoomPhotoSignedUrl = async (storedUrl: string): Promise<string | null> => {
  const path = getRoomPhotoPath(storedUrl);
  if (!path) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(ROOM_PHOTO_BUCKET)
    .createSignedUrl(path, ROOM_PHOTO_URL_TTL_SECONDS);

  if (error) {
    console.warn("Failed to sign room photo URL:", error.message);
    return null;
  }

  return data.signedUrl;
};

const mapRoomRowToListing = async (
  row: RoomRow,
  distanceKm?: number,
  includeGallery = false,
): Promise<Listing> => {
  const ownerName = row.utenti?.nome_utente ??
    (row.utenti?.nome && row.utenti?.cognome ? `${row.utenti.nome} ${row.utenti.cognome}` : "Unknown");
  // Tipologia / taglio / furnished / pets / smokers / feature groups are read from the columns of `stanze`.
  const listingFeatures = roomColumnsToListingFeatures(row);
  const photos = [...(row.stanze_foto ?? [])].sort(
    (left, right) => (left.ordine ?? 0) - (right.ordine ?? 0),
  );
  const coverIndex = Math.max(0, photos.findIndex((photo) => photo.copertina));
  const coverPhoto = photos[coverIndex] ?? photos[0];
  const signedPhotoUrls = includeGallery
    ? await Promise.all(photos.map((photo) => photo.url ? createRoomPhotoSignedUrl(photo.url) : null))
    : [];
  const coverPhotoUrl = includeGallery
    ? signedPhotoUrls[coverIndex]
    : coverPhoto?.url ? await createRoomPhotoSignedUrl(coverPhoto.url) : null;
  // The owner's profile photo, only on the listing page (cards don't show the owner).
  const ownerPhotoUrl = includeGallery ? await signedProfilePhotoUrl(row.utenti?.foto_profilo) : null;

  return {
    id: row.id,
    ...(includeGallery && row.proprietario_id ? { ownerId: row.proprietario_id } : {}),
    title: row.titolo ?? "",
    zone: row.universita?.nome ?? "",
    price: Number(row.prezzo ?? 0),
    owner: ownerName,
    ...(ownerPhotoUrl ? { ownerPhotoUrl } : {}),
    rating: 0,
    photos: photos.length,
    ...(coverPhotoUrl ? { coverPhotoUrl } : {}),
    ...(includeGallery ? { photoUrls: signedPhotoUrls.filter((url): url is string => Boolean(url)) } : {}),
    ...listingFeatures,
    wifi: hasWifiIncluded(listingFeatures.features),
    description: row.descrizione ?? "",
    available: Boolean(row.attiva) && row.stato === "disponibile",
    ...(distanceKm !== undefined ? { distanceKm } : {}),
  };
};

/** Decimals kept on a room's public coordinates: 3 ≈ 100 m, enough for a map without the exact door. */
const PUBLIC_COORDINATE_DECIMALS = 3 as const;
const roundCoordinate = (value: number) => Number(Number(value).toFixed(PUBLIC_COORDINATE_DECIMALS));

const ROOM_SELECT = `
  id,
  titolo,
  prezzo,
  descrizione,
  attiva,
  stato,
  ${ROOM_FEATURE_COLUMNS},
  universita_id,
  proprietario_id,
  latitudine,
  longitudine,
  universita:universita_id(nome),
  utenti:proprietario_id(nome_utente, nome, cognome, foto_profilo),
  stanze_foto(url, copertina, ordine)
`;

/**
 * GET /api/listings
 * Returns a list of listings (rooms) with optional filtering.
 */
router.get(API_ROUTE_PATHS.LISTINGS, requireAuth, requireAppAccess, async (req: Request, res: Response) => {
  try {
    const query = ListListingsQueryParams.parse(req.query);

    let dbQuery = supabaseAdmin.from("stanze").select(ROOM_SELECT);

    // Ricerca per università: se conosciamo le sue coordinate mostriamo le
    // stanze entro SEARCH_RADIUS_KM ordinate per distanza (bounding box in SQL,
    // distanza reale in memoria), altrimenti ripieghiamo sul confronto per nome.
    let university: UniversityPoint | null = null;
    if (query.zone) {
      const { data: matches, error: uniError } = await supabaseAdmin
        .from("universita")
        .select("id, nome, latitudine, longitudine")
        .ilike("nome", `%${query.zone}%`)
        .limit(UNIVERSITY_MATCH_LIMIT);
      if (uniError) throw uniError;
      const wanted = query.zone.trim().toLowerCase();
      university =
        (matches ?? []).find((u) => u.nome?.toLowerCase() === wanted) ?? matches?.[0] ?? null;
    }

    const hasUniversityCoords =
      university?.latitudine != null && university?.longitudine != null;

    if (university && hasUniversityCoords) {
      const box = boundingBox(university.latitudine!, university.longitudine!, SEARCH_RADIUS_KM);
      // Stanze nel rettangolo OPPURE già associate a questa università
      // (annunci vecchi senza coordinate).
      dbQuery = dbQuery.or(
        `universita_id.eq.${university.id},and(latitudine.gte.${box.minLat},latitudine.lte.${box.maxLat},longitudine.gte.${box.minLon},longitudine.lte.${box.maxLon})`,
      );
    }

    if (query.maxPrice !== undefined) {
      dbQuery = dbQuery.lte("prezzo", query.maxPrice);
    }
    // `furnished` si ricava da `mobili_inclusi` (vedi room-features.ts), quindi si filtra
    // dopo la mappatura. Si confronta la stringa grezza perché z.coerce.boolean()
    // trasforma anche "false" in true.
    const furnishedOnly = String(req.query.furnished) === "true";

    dbQuery = dbQuery.eq("attiva", true).eq("stato", "disponibile");

    const { data, error } = await dbQuery;
    if (error) throw error;

    const rows = (data ?? []) as unknown as RoomRow[];
    let listings: Listing[];

    if (university && hasUniversityCoords) {
      const uni = university;
      // Entro il raggio, dalla più vicina alla più lontana; le stanze già
      // associate a questa università restano sempre (quelle senza coordinate
      // finiscono in fondo).
      const nearby = rows
        .map((row) => {
          const hasCoords = row.latitudine != null && row.longitudine != null;
          const distance = hasCoords
            ? haversineKm(
                uni.latitudine!,
                uni.longitudine!,
                Number(row.latitudine),
                Number(row.longitudine),
              )
            : null;
          const linked = String(row.universita_id ?? "") === String(uni.id);
          return { row, distance, linked };
        })
        .filter(({ distance, linked }) => linked || (distance !== null && distance <= SEARCH_RADIUS_KM));
      const ranked = await Promise.all(
        nearby.map(async ({ row, distance }) => ({
          listing: {
            ...(await mapRoomRowToListing(
              row,
              distance !== null ? Math.round(distance * 10) / 10 : undefined,
            )),
            // La distanza è calcolata dall'università cercata, quindi la card deve
            // mostrare quella (non l'università più vicina associata alla stanza).
            zone: uni.nome,
          },
          distance,
        })),
      );
      ranked.sort((a, b) => {
        if (a.distance === null && b.distance === null) return a.listing.price - b.listing.price;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
      listings = ranked.map((item) => item.listing);
    } else {
      const mappedListings = await Promise.all(rows.map((row) => mapRoomRowToListing(row)));
      listings = mappedListings.filter(
        (listing) => !query.zone || listing.zone.toLowerCase().includes(query.zone.toLowerCase()),
      );
    }

    if (furnishedOnly) listings = listings.filter((listing) => listing.furnished);

    return res.json(ListListingsResponse.parse(listings));
  } catch (error) {
    console.error("Error fetching listings:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
/**
 * GET /api/listings/:id
 * Get a single listing by ID.
 */
router.get(API_ROUTE_PATHS.LISTING_BY_ID, requireAuth, requireAppAccess, async (req: Request, res: Response) => {
  try {
    const { id } = GetListingParams.parse({ id: Number(req.params.id) });

    const { data, error } = await supabaseAdmin
      .from("stanze")
      .select(`
        id,
        titolo,
        prezzo,
        descrizione,
        attiva,
        stato,
        ${ROOM_FEATURE_COLUMNS},
        universita_id,
        proprietario_id,
        latitudine,
        longitudine,
        universita:universita_id(nome, latitudine, longitudine),
        utenti:proprietario_id(nome_utente, nome, cognome, foto_profilo),
        stanze_foto(url, copertina, ordine)
      `)
      .eq("id", id)
      .eq("attiva", true)
      .eq("stato", "disponibile")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return res.status(404).json({ error: "Listing not found" });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const row = data as RoomRow;
    const listing: Listing = await mapRoomRowToListing(row, undefined, true);
    // Map on the listing page: the room's position rounded to ~100 m (never the exact
    // address on a public page) and the coordinates of its university.
    if (row.latitudine != null && row.longitudine != null) {
      listing.location = { latitude: roundCoordinate(row.latitudine), longitude: roundCoordinate(row.longitudine) };
    }
    const nearbyPlaces = await readNearbyPlaces(row.id, row.latitudine, row.longitudine);
    if (nearbyPlaces) listing.nearbyPlaces = nearbyPlaces;
    if (row.universita?.nome && row.universita.latitudine != null && row.universita.longitudine != null) {
      listing.university = {
        name: row.universita.nome,
        latitude: row.universita.latitudine,
        longitude: row.universita.longitudine,
      };
    }

    return res.json(GetListingResponse.parse(listing));
  } catch (error) {
    console.error("Error fetching listing by ID:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/listings
 * Create a new listing (requires authentication).
 */
router.post(API_ROUTE_PATHS.LISTINGS, requireAuth, async (req: Request, res: Response) => {
  try {
    const authedReq = req as typeof req & { userId: string; userEmail?: string };
    const { data: ownerRecord, error: ownerCheckError } = await supabaseAdmin
      .from("utenti")
      .select("owner")
      .eq("id", authedReq.userId)
      .maybeSingle();

    if (ownerCheckError) {
      console.error("Failed to verify listing owner:", ownerCheckError);
      return res.status(500).json({ error: "Unable to verify owner status" });
    }
    if (ownerRecord?.owner !== true) {
      return res.status(403).json({ error: "Only verified owners can create listings" });
    }

    const parsed = CreateListingBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dati non validi", details: parsed.error.issues });
    }
    const input = parsed.data;
    // Assegniamo l'università più vicina (entro SEARCH_RADIUS_KM) in base alle
    // coordinate dell'indirizzo scelto. In ricerca la stanza comparirà comunque
    // per tutte le università nel raggio, non solo per questa.
    const hasCoords =
      input.latitude !== undefined &&
      input.longitude !== undefined &&
      !(input.latitude === 0 && input.longitude === 0);

    if (!hasCoords && !input.zone) {
      return res.status(400).json({ error: "Seleziona un indirizzo dai suggerimenti" });
    }

    let universitaId: string | number | null = null;
    let zoneName = input.zone ?? "";

    if (hasCoords) {
      const { data: universities, error: uniError } = await supabaseAdmin
        .from("universita")
        .select("id, nome, latitudine, longitudine");
      if (uniError) throw uniError;

      const match = nearestUniversity(
        input.latitude!,
        input.longitude!,
        (universities ?? []) as UniversityPoint[],
      );
      if (match) {
        universitaId = match.university.id;
        zoneName = match.university.nome;
      }
    }

    // Fallback: zona indicata per nome (client vecchi / indirizzo senza coordinate).
    if (universitaId === null && input.zone) {
      const { data: uniData, error: uniError } = await supabaseAdmin
        .from("universita")
        .select("id")
        .eq("nome", input.zone)
        .maybeSingle();
      if (uniError) throw uniError;
      if (uniData) universitaId = uniData.id;
    }

    // Tipologia / taglio / furnished / pets / smokers / feature groups -> columns of `stanze`
    // (tipologia_proprieta, taglio_appartamento, mobili_inclusi, animali_consentiti,
    // fumatori_consentiti, spese_incluse, elettrodomestici, arredi, servizi).
    // Values were validated by CreateListingBody; the layout is dropped unless it is an apartment.
    const featureColumns = listingFeaturesToRoomColumns({
      propertyType: input.propertyType ?? null,
      apartmentLayout: input.apartmentLayout ?? null,
      furnished: input.furnished ?? false,
      petsAllowed: input.petsAllowed ?? false,
      smokersAllowed: input.smokersAllowed ?? false,
      features: { ...emptyListingFeatureGroups(), ...input.features },
    });

    const newRoomRow = {
      titolo: input.title,
      descrizione: input.description,
      prezzo: input.price,
      citta: input.city ?? null,
      indirizzo: input.address ?? null,
      cap: input.postcode ?? null,
      latitudine: hasCoords ? input.latitude : null,
      longitudine: hasCoords ? input.longitude : null,
      universita_id: universitaId,
      proprietario_id: authedReq.userId,
      ...featureColumns,
      attiva: true,
      stato: "disponibile",
    };

    const { data: newListing, error: insertError } = await supabaseAdmin
      .from("stanze")
      .insert(newRoomRow)
      .select("id, titolo, prezzo, descrizione, attiva, stato")
      .single();

    if (insertError) {
      throw insertError;
    }

    if (!newListing) {
      throw new Error("Failed to create listing");
    }
    // Nearby places are looked up in the background and stored on the room.
    if (hasCoords) refreshNearbyPlaces(newListing.id, input.latitude!, input.longitude!);

    const createdFeatures = roomColumnsToListingFeatures(featureColumns);
    // We need to map the created listing to the Listing type for response
    // For simplicity, we'll return a basic Listing object (similar to above but with defaults)
    const listing: Listing = {
      id: newListing.id,
      title: newListing.titolo,
      zone: zoneName,
      price: Number(newListing.prezzo),
      owner: authedReq.userId, // TODO: get actual name
      rating: 0,
      photos: 0,
      ...createdFeatures,
      wifi: hasWifiIncluded(createdFeatures.features),
      description: newListing.descrizione ?? "",
      available: newListing.attiva && newListing.stato === "disponibile",
    };

    return res.status(201).json(CreateListingResponse.parse(listing));
  } catch (error) {
    console.error("Error creating listing:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  API_ROUTE_PATHS.OWNER_LISTING_PHOTOS,
  requireAuth,
  raw({ type: () => true, limit: ROOM_PHOTO_MAX_SIZE_BYTES }),
  async (req: Request, res: Response) => {
    let uploadedPath: string | null = null;
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid listing ID" });
      }

      const contentType = uploadImageType(req.header("content-type"));
      if (!contentType) {
        return res.status(400).json({ error: "Only PNG and JPEG images are allowed" });
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0 || req.body.length > ROOM_PHOTO_MAX_SIZE_BYTES) {
        return res.status(400).json({ error: "Image must be between 1 byte and 8 MB" });
      }
      if (!isValidImage(req.body, contentType)) {
        return res.status(400).json({ error: "Invalid image file" });
      }

      const authedReq = req as typeof req & { userId: string };
      const { data: listing, error: listingError } = await supabaseAdmin
        .from("stanze")
        .select("id")
        .eq("id", id)
        .eq("proprietario_id", authedReq.userId)
        .maybeSingle();

      if (listingError) throw listingError;
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const { data: existingPhotos, error: photosError } = await supabaseAdmin
        .from("stanze_foto")
        .select("ordine, copertina")
        .eq("stanza_id", id);

      if (photosError) throw photosError;
      if ((existingPhotos ?? []).length >= ROOM_PHOTO_MAX_COUNT) {
        return res.status(400).json({ error: `A listing can have at most ${ROOM_PHOTO_MAX_COUNT} photos` });
      }

      const extension = contentType === "image/png" ? "png" : "jpg";
      uploadedPath = `${id}/${randomUUID()}.${extension}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(ROOM_PHOTO_BUCKET)
        .upload(uploadedPath, req.body, {
          contentType,
          cacheControl: ROOM_PHOTO_CACHE_CONTROL_MAX_AGE_SECONDS,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const photoOrder = Math.max(-1, ...(existingPhotos ?? []).map((photo) => photo.ordine ?? -1)) + 1;
      const isCover = !(existingPhotos ?? []).some((photo) => photo.copertina);
      const { data: photo, error: insertError } = await supabaseAdmin
        .from("stanze_foto")
        .insert({
          stanza_id: id,
          url: uploadedPath,
          copertina: isCover,
          ordine: photoOrder,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      return res.status(201).json({
        id: photo.id,
        url: await createRoomPhotoSignedUrl(uploadedPath),
        cover: isCover,
      });
    } catch (error) {
      if (uploadedPath) {
        await supabaseAdmin.storage.from(ROOM_PHOTO_BUCKET).remove([uploadedPath]);
      }
      console.error("Error uploading room photo:", error);
      return res.status(500).json({ error: "Unable to upload photo" });
    }
  },
);

router.delete(
  API_ROUTE_PATHS.OWNER_LISTING_PHOTO_BY_ID,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const photoId = Number(req.params.photoId);
      if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(photoId) || photoId <= 0) {
        return res.status(400).json({ error: "Invalid listing or photo ID" });
      }

      const authedReq = req as typeof req & { userId: string };
      const { data: listing, error: listingError } = await supabaseAdmin
        .from("stanze")
        .select("id")
        .eq("id", id)
        .eq("proprietario_id", authedReq.userId)
        .maybeSingle();

      if (listingError) throw listingError;
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const { data: photo, error: photoError } = await supabaseAdmin
        .from("stanze_foto")
        .select("id, url, copertina")
        .eq("id", photoId)
        .eq("stanza_id", id)
        .maybeSingle();

      if (photoError) throw photoError;
      if (!photo) return res.status(404).json({ error: "Photo not found" });

      const { error: deleteError } = await supabaseAdmin
        .from("stanze_foto")
        .delete()
        .eq("id", photoId)
        .eq("stanza_id", id);

      if (deleteError) throw deleteError;

      if (photo.copertina) {
        const { data: remainingPhotos, error: remainingPhotosError } = await supabaseAdmin
          .from("stanze_foto")
          .select("id")
          .eq("stanza_id", id)
          .order("ordine", { ascending: true })
          .limit(1);

        if (remainingPhotosError) {
          console.warn("Photo was deleted, but a replacement cover could not be selected:", remainingPhotosError.message);
        }
        if (remainingPhotos?.[0]) {
          const { error: updateCoverError } = await supabaseAdmin
            .from("stanze_foto")
            .update({ copertina: true })
            .eq("id", remainingPhotos[0].id);

          if (updateCoverError) {
            console.warn("Photo was deleted, but its replacement cover could not be updated:", updateCoverError.message);
          }
        }
      }

      const photoPath = getRoomPhotoPath(photo.url);
      if (photoPath) {
        const { error: storageError } = await supabaseAdmin.storage
          .from(ROOM_PHOTO_BUCKET)
          .remove([photoPath]);

        if (storageError) {
          console.warn("Photo record was deleted, but its file could not be removed from storage:", storageError.message);
        }
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting listing photo:", error);
      return res.status(500).json({ error: "Unable to delete photo" });
    }
  },
);

// Conversations and messages live in ./chat.ts

router.get(API_ROUTE_PATHS.OWNER_DASHBOARD, requireAuth, async (req: Request, res: Response) => {
  // This endpoint also uses mock data; we'll leave it as is for now.
  // TODO: Implement with real data.
  const authedReq = req as typeof req & { userId: string; userEmail?: string };

  // We would need to fetch the owner's listings from the database.
  // For now, we return mock data.
  return res.json(GetOwnerDashboardResponse.parse({
    activeListings: 0,
    pendingRequests: 0,
    activeChats: 0,
    monthlyEarnings: 0,
    averageRating: 0,
  }));
});

// GET /api/owner/listings
// Get listings for the current owner
router.get(API_ROUTE_PATHS.OWNER_LISTINGS, requireAuth, async (req: Request, res: Response) => {
  try {
    const authedReq = req as typeof req & { userId: string };

    let dbQuery = supabaseAdmin
      .from("stanze")
      .select(`
        id,
        titolo,
        prezzo,
        descrizione,
        attiva,
        stato,
        ${ROOM_FEATURE_COLUMNS},
        universita_id,
        proprietario_id,
        universita:universita_id(nome),
        utenti:proprietario_id(nome_utente, nome, cognome, foto_profilo),
        stanze_foto(url, copertina, ordine)
      `);

    dbQuery = dbQuery.eq("proprietario_id", authedReq.userId);

    const { data, error } = await dbQuery;

    if (error) throw error;

    const rows = ((data ?? []) as RoomRow[]);
    const listings: Listing[] = await Promise.all(rows.map((row) => mapRoomRowToListing(row)));

    return res.json(listings);
  } catch (error) {
    console.error("Error fetching owner listings:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/owner/listings/:id
// Get a single listing for the current owner (for editing).
router.get(API_ROUTE_PATHS.OWNER_LISTING_BY_ID, requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const authedReq = req as typeof req & { userId: string };

    const { data, error } = await supabaseAdmin
      .from("stanze")
      .select(`
        id,
        titolo,
        descrizione,
        prezzo,
        indirizzo,
        citta,
        cap,
        latitudine,
        longitudine,
        ${ROOM_FEATURE_COLUMNS},
        stanze_foto(id, url, copertina, ordine)
      `)
      .eq("id", id)
      .eq("proprietario_id", authedReq.userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return res.status(404).json({ error: "Listing not found" });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // Tipologia / taglio / furnished / pets / smokers / feature groups are read from the columns of `stanze`.
    const listingFeatures = roomColumnsToListingFeatures(data as Partial<RoomFeatureColumns>);

    const response = {
      id: data.id,
      title: data.titolo ?? "",
      description: data.descrizione ?? "",
      price: Number(data.prezzo ?? 0),
      address: data.indirizzo ?? "",
      city: data.citta ?? "",
      postcode: data.cap ?? "",
      latitude: data.latitudine ?? 0,
      longitude: data.longitudine ?? 0,
      ...listingFeatures,
      photos: await Promise.all(
        [...(data.stanze_foto ?? [])]
          .sort((left, right) => (left.ordine ?? 0) - (right.ordine ?? 0))
          .map(async (photo) => ({
            id: photo.id,
            url: await createRoomPhotoSignedUrl(photo.url),
            cover: photo.copertina ?? false,
          })),
      ),
    };

    return res.json(response);
  } catch (error) {
    console.error("Error fetching listing for owner:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/listings/:id/release
  // Release a room (set stato to disponibile)
  router.post(API_ROUTE_PATHS.LISTING_RELEASE, requireAuth, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid listing ID" });
      }

      const authedReq = req as typeof req & { userId: string };

      const { data: listing, error: listingError } = await supabaseAdmin
        .from("stanze")
        .select("id, proprietario_id")
        .eq("id", id)
        .maybeSingle();

      if (listingError) throw listingError;
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      if (listing.proprietario_id !== authedReq.userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Call the libera_stanza RPC function
      const { error: rpcError } = await supabaseAdmin.rpc("libera_stanza", {
        p_stanza_id: id,
        p_owner_id: authedReq.userId,
      });

      if (rpcError) {
        // Map error codes to HTTP status
        if (rpcError.code === "P0001") {
          // not_owner
          return res.status(403).json({ error: "Not authorized" });
        }
        if (rpcError.code === "P0006") {
          // not_accepted
          return res.status(409).json({ error: "Room is not accepted" });
        }
        // For any other error, return 500
        console.error("Error releasing room:", rpcError);
        return res.status(500).json({ error: "Internal server error" });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Error releasing room:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });


// PUT /api/owner/listings/:id
// Update a listing for the current owner.
router.put(API_ROUTE_PATHS.OWNER_LISTING_BY_ID, requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const authedReq = req as typeof req & { userId: string };

    // Validate request body
    const {
      title,
      description,
      price,
      propertyType,
      apartmentLayout,
      furnished,
      petsAllowed,
      smokersAllowed,
      features,
      address,
      city,
      postcode,
      latitude,
      longitude,
    } = req.body;

    if (typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "Title is required" });
    }
    if (typeof description !== "string" || description.trim() === "") {
      return res.status(400).json({ error: "Description is required" });
    }
    if (typeof price !== "number" || !Number.isFinite(price) || price < 1) {
      return res.status(400).json({ error: "Price must be a number greater than or equal to 1" });
    }
    // Only values of the database enums (and the known `servizi` options) are accepted.
    const parsedPropertyType = ListingPropertyTypeSchema.optional().safeParse(propertyType);
    const parsedApartmentLayout = ListingApartmentLayoutSchema.optional().safeParse(apartmentLayout);
    const parsedFeatures = ListingFeatureGroupsSchema.optional().safeParse(features);
    if (!parsedPropertyType.success || !parsedApartmentLayout.success || !parsedFeatures.success) {
      return res.status(400).json({ error: "Invalid listing features" });
    }

    // Load current row to verify ownership and get the current feature columns
    const { data: currentRow, error: fetchError } = await supabaseAdmin
      .from("stanze")
      .select(`id, ${ROOM_FEATURE_COLUMNS}, indirizzo, citta, cap, latitudine, longitudine`)
      .eq("id", id)
      .eq("proprietario_id", authedReq.userId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return res.status(404).json({ error: "Listing not found" });
      }
      throw fetchError;
    }

    if (!currentRow) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // Tipologia / taglio / furnished / pets / smokers / feature groups -> columns of `stanze`.
    // Fields missing from the body keep their current value; `servizi` values not
    // managed by the form are kept as they are.
    const currentFeatureColumns = currentRow as Partial<RoomFeatureColumns>;
    const currentFeatures = roomColumnsToListingFeatures(currentFeatureColumns);
    const featureColumns = listingFeaturesToRoomColumns(
      {
        propertyType:
          parsedPropertyType.data !== undefined ? parsedPropertyType.data : currentFeatures.propertyType,
        apartmentLayout:
          parsedApartmentLayout.data !== undefined ? parsedApartmentLayout.data : currentFeatures.apartmentLayout,
        furnished: typeof furnished === "boolean" ? furnished : currentFeatures.furnished,
        petsAllowed: typeof petsAllowed === "boolean" ? petsAllowed : currentFeatures.petsAllowed,
        smokersAllowed: typeof smokersAllowed === "boolean" ? smokersAllowed : currentFeatures.smokersAllowed,
        features: parsedFeatures.data ?? currentFeatures.features,
      },
      currentFeatureColumns.servizi,
    );

    // Build update object
    const updateData: any = {
      titolo: title.trim(),
      descrizione: description.trim(),
      prezzo: price,
      ...featureColumns,
      updated_at: new Date().toISOString(),
    };

    // Check if coordinates need updating
    const hasCoords =
      latitude !== undefined &&
      longitude !== undefined &&
      !(latitude === 0 && longitude === 0);
    const currentHasCoords =
      currentRow.latitudine !== null &&
      currentRow.longitudine !== null &&
      !(Number(currentRow.latitudine) === 0 && Number(currentRow.longitudine) === 0);

    if (hasCoords) {
      const latDiff =
        Math.abs(Number(currentRow.latitudine || 0) - latitude) > COORDINATE_CHANGE_TOLERANCE_DEGREES;
      const lngDiff =
        Math.abs(Number(currentRow.longitudine || 0) - longitude) > COORDINATE_CHANGE_TOLERANCE_DEGREES;
      if (latDiff || lngDiff) {
        // Update address-related fields and recompute university
        updateData.indirizzo = address ?? null;
        updateData.citta = city ?? null;
        updateData.cap = postcode ?? null;
        updateData.latitudine = latitude;
        updateData.longitudine = longitude;

        // Find nearest university (same logic as POST route)
        if (latitude !== undefined && longitude !== undefined) {
          const { data: universities, error: uniError } = await supabaseAdmin
            .from("universita")
            .select("id, nome, latitudine, longitudine");
          if (!uniError && universities) {
            const match = nearestUniversity(
              latitude,
              longitude,
              (universities as unknown as UniversityPoint[]),
            );
            // Nessuna università nel raggio: si scollega quella vecchia, altrimenti
            // la stanza continuerebbe a comparire nelle ricerche di quella zona.
            updateData.universita_id = match ? match.university.id : null;
          }
        }
      }
    }

    // Perform update
    const { error: updateError } = await supabaseAdmin
      .from("stanze")
      .update(updateData)
      .eq("id", id)
      .eq("proprietario_id", authedReq.userId);

    if (updateError) {
      console.error("Error updating listing:", updateError);
      return res.status(500).json({ error: "Internal server error" });
    }
    // The room moved: its nearby places are recomputed in the background.
    if (updateData.latitudine !== undefined && updateData.longitudine !== undefined) {
      refreshNearbyPlaces(id, updateData.latitudine, updateData.longitudine);
    }

    return res.json({ id });
  } catch (error) {
    console.error("Error updating listing for owner:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete(API_ROUTE_PATHS.OWNER_LISTING_BY_ID, requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const authedReq = req as typeof req & { userId: string };
    const { data: listing, error: listingError } = await supabaseAdmin
      .from("stanze")
      .select("id")
      .eq("id", id)
      .eq("proprietario_id", authedReq.userId)
      .maybeSingle();

    if (listingError) throw listingError;
    if (!listing) return res.status(404).json({ error: "Listing not found" });

    const { data: photos, error: photosError } = await supabaseAdmin
      .from("stanze_foto")
      .select("url")
      .eq("stanza_id", id);

    if (photosError) throw photosError;

    const { data: conversations, error: conversationsError } = await supabaseAdmin
      .from("conversazioni")
      .select("id")
      .eq("stanza_id", id);

    if (conversationsError) throw conversationsError;

    const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
    if (conversationIds.length > 0) {
      const { error: messagesError } = await supabaseAdmin
        .from("messaggi")
        .delete()
        .in("conversazione_id", conversationIds);

      if (messagesError) throw messagesError;

      const { error: participantsError } = await supabaseAdmin
        .from("conversazioni_utenti")
        .delete()
        .in("conversazione_id", conversationIds);

      if (participantsError) throw participantsError;

      const { error: conversationsDeleteError } = await supabaseAdmin
        .from("conversazioni")
        .delete()
        .in("id", conversationIds);

      if (conversationsDeleteError) throw conversationsDeleteError;
    }

    const { error: photosDeleteError } = await supabaseAdmin
      .from("stanze_foto")
      .delete()
      .eq("stanza_id", id);

    if (photosDeleteError) throw photosDeleteError;

    const { data: deletedListing, error: deleteError } = await supabaseAdmin
      .from("stanze")
      .delete()
      .eq("id", id)
      .eq("proprietario_id", authedReq.userId)
      .select("id")
      .maybeSingle();

    if (deleteError) throw deleteError;
    if (!deletedListing) return res.status(404).json({ error: "Listing not found" });

    const photoPaths = [...new Set(
      (photos ?? [])
        .map((photo) => getRoomPhotoPath(photo.url))
        .filter((path): path is string => path !== null),
    )];

    if (photoPaths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(ROOM_PHOTO_BUCKET)
        .remove(photoPaths);

      if (storageError) {
        console.warn("Listing was deleted, but its photos could not be removed from storage:", storageError.message);
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting owner listing:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;