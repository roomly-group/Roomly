import { raw, Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabase-admin.js";
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
  servizi?: string[] | null;
  universita_id?: string | number | null;
  latitudine?: number | null;
  longitudine?: number | null;
  stanze_foto?: Array<{ url?: string | null; copertina?: boolean | null; ordine?: number | null }> | null;
  universita?: { nome?: string | null } | null;
  utenti?: { nome_utente?: string | null; nome?: string | null; cognome?: string | null } | null;
};

const router: IRouter = Router();

const isValidRoomPhoto = (file: Buffer, contentType: string): boolean => {
  if (contentType === "image/png") {
    if (!file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
    let offset = 8;
    while (offset + 12 <= file.length) {
      const chunkLength = file.readUInt32BE(offset);
      const chunkEnd = offset + 12 + chunkLength;
      if (chunkEnd > file.length) return false;
      const chunkType = file.toString("ascii", offset + 4, offset + 8);
      if (chunkType === "IEND") return chunkLength === 0 && chunkEnd === file.length;
      offset = chunkEnd;
    }
    return false;
  }

  return contentType === "image/jpeg" &&
    file.length >= 4 &&
    file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff &&
    file[file.length - 2] === 0xff && file[file.length - 1] === 0xd9;
};

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
  const serviziArray = Array.isArray(row.servizi) ? row.servizi : [];
  const furnished = serviziArray.some((servizio: string) =>
    ["arredato", "mobilio", "letto", "armadio"].includes(servizio.toLowerCase())
  );
  const wifi = serviziArray.some((servizio: string) =>
    servizio.toLowerCase().includes("internet")
  );
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

  return {
    id: row.id,
    ...(includeGallery && row.proprietario_id ? { ownerId: row.proprietario_id } : {}),
    title: row.titolo ?? "",
    zone: row.universita?.nome ?? "",
    price: Number(row.prezzo ?? 0),
    owner: ownerName,
    rating: 0,
    photos: photos.length,
    ...(coverPhotoUrl ? { coverPhotoUrl } : {}),
    ...(includeGallery ? { photoUrls: signedPhotoUrls.filter((url): url is string => Boolean(url)) } : {}),
    furnished,
    wifi,
    description: row.descrizione ?? "",
    available: Boolean(row.attiva) && row.stato === "disponibile",
    ...(distanceKm !== undefined ? { distanceKm } : {}),
  };
};

const ROOM_SELECT = `
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
  utenti:proprietario_id(nome_utente, nome, cognome),
  stanze_foto(url, copertina, ordine)
`;

/**
 * GET /api/listings
 * Returns a list of listings (rooms) with optional filtering.
 */
router.get(API_ROUTE_PATHS.LISTINGS, async (req: Request, res: Response) => {
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
    // `furnished` non è una colonna: si ricava da `servizi`, quindi si filtra
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
          listing: await mapRoomRowToListing(
            row,
            distance !== null ? Math.round(distance * 10) / 10 : undefined,
          ),
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
router.get(API_ROUTE_PATHS.LISTING_BY_ID, async (req: Request, res: Response) => {
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
        servizi,
        universita_id,
        proprietario_id,
        universita:universita_id(nome),
        utenti:proprietario_id(nome_utente, nome, cognome),
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

    const listing: Listing = await mapRoomRowToListing(data as RoomRow, undefined, true);

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

    // Insert the new listing (se le colonne geo non esistono ancora, riprova senza)
    const baseRow = {
      titolo: input.title,
      descrizione: input.description,
      prezzo: input.price,
      citta: input.city ?? null,
      universita_id: universitaId,
      proprietario_id: authedReq.userId,
      servizi: [
        ...(input.furnished ? ["arredato"] : []),
        ...(input.wifi ? ["internet"] : []),
        ...(input.amenities ?? []),
      ],
      attiva: true,
      stato: "disponibile",
    };
    const geoRow = {
      indirizzo: input.address ?? null,
      cap: input.postcode ?? null,
      latitudine: hasCoords ? input.latitude : null,
      longitudine: hasCoords ? input.longitude : null,
    };
    // `tipo` è NOT NULL su alcuni database: proviamo i valori più comuni,
    // e se la colonna ha un vincolo diverso lasciamo il default del DB.
    const tipoCandidates: Array<string | undefined> = [
      process.env.ROOM_TIPO_DEFAULT,
      "singola",
      "stanza_singola",
      "stanza",
      undefined,
    ].filter((v, i, arr) => arr.indexOf(v) === i);

    let newListing: any = null;
    let insertError: any = null;
    outer: for (const withGeo of [true, false]) {
      for (const tipo of tipoCandidates) {
        const row = { ...baseRow, ...(withGeo ? geoRow : {}), ...(tipo ? { tipo } : {}) };
        const result = await supabaseAdmin.from("stanze").insert(row).select().single();
        if (!result.error) {
          newListing = result.data;
          insertError = null;
          break outer;
        }
        insertError = result.error;
        // Colonna geo mancante: riprova senza geo. Valore `tipo` rifiutato (22P02/23514/23502): prossimo candidato.
        if (result.error.code === "PGRST204") continue outer;
        if (!["22P02", "23514", "23502"].includes(result.error.code)) break outer;
      }
    }

    if (insertError) {
      console.error("Insert with geo columns failed, retrying without:", insertError);
      ({ data: newListing, error: insertError } = await supabaseAdmin
        .from("stanze")
        .insert(baseRow)
        .select()
        .single());
    }

    if (insertError) {
      throw insertError;
    }

    if (!newListing) {
      throw new Error("Failed to create listing");
    }

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
      furnished: input.furnished ?? false,
      wifi: input.wifi ?? false,
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

      const contentType = req.header("content-type")?.split(";")[0].trim().toLowerCase();
      if (contentType !== "image/png" && contentType !== "image/jpeg") {
        return res.status(400).json({ error: "Only PNG and JPEG images are allowed" });
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0 || req.body.length > ROOM_PHOTO_MAX_SIZE_BYTES) {
        return res.status(400).json({ error: "Image must be between 1 byte and 8 MB" });
      }
      if (!isValidRoomPhoto(req.body, contentType)) {
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

      return res.status(201).json({ id: photo.id, url: uploadedPath, cover: isCover });
    } catch (error) {
      if (uploadedPath) {
        await supabaseAdmin.storage.from(ROOM_PHOTO_BUCKET).remove([uploadedPath]);
      }
      console.error("Error uploading room photo:", error);
      return res.status(500).json({ error: "Unable to upload photo" });
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
        servizi,
        universita_id,
        proprietario_id,
        universita:universita_id(nome),
        utenti:proprietario_id(nome_utente, nome, cognome),
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
        servizi
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

    const serviziArray = Array.isArray(data.servizi) ? data.servizi : [];
    const furnished = serviziArray.some((servizio: string) =>
      servizio.toLowerCase() === "arredato"
    );
    const wifi = serviziArray.some((servizio: string) =>
      servizio.toLowerCase() === "internet"
    );

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
      furnished,
      wifi,
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
    const { title, description, price, furnished, wifi, address, city, postcode, latitude, longitude } = req.body;

    if (typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "Title is required" });
    }
    if (typeof description !== "string" || description.trim() === "") {
      return res.status(400).json({ error: "Description is required" });
    }
    if (typeof price !== "number" || !Number.isFinite(price) || price < 1) {
      return res.status(400).json({ error: "Price must be a number greater than or equal to 1" });
    }

    // Load current row to verify ownership and get existing services
    const { data: currentRow, error: fetchError } = await supabaseAdmin
      .from("stanze")
      .select("id, servizi, indirizzo, citta, cap, latitudine, longitudine")
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

    // Prepare services array: keep existing services except 'arredato' and 'internet', then add based on furnished/wifi flags
    const existingServizi = Array.isArray(currentRow.servizi) ? currentRow.servizi : [];
    const serviziWithoutFlags = existingServizi.filter(
      (servizio: string) =>
        servizio.toLowerCase() !== "arredato" && servizio.toLowerCase() !== "internet"
    );
    const serviziToUpdate = [
      ...serviziWithoutFlags,
      ...(furnished ? ["arredato"] : []),
      ...(wifi ? ["internet"] : []),
    ];

    // Build update object
    const updateData: any = {
      titolo: title.trim(),
      descrizione: description.trim(),
      prezzo: price,
      servizi: serviziToUpdate,
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

    return res.json({ id });
  } catch (error) {
    console.error("Error updating listing for owner:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;