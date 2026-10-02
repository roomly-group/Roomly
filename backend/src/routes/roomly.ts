import { Router, type IRouter, type Request, type Response } from "express";
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
  ListMessagesParams,
  SendMessageBody,
  SendMessageParams,
  CreateListingResponse,
  GetListingResponse,
  ListListingsResponse,
  ListConversationsResponse,
  ListMessagesResponse,
  SendMessageResponse,
  GetOwnerDashboardResponse,
} from "@workspace/api-zod";

type RoomRow = {
  id: number;
  titolo: string | null;
  prezzo: number | string | null;
  descrizione?: string | null;
  attiva?: boolean | null;
  stato?: string | null;
  servizi?: string[] | null;
  universita_id?: string | number | null;
  latitudine?: number | null;
  longitudine?: number | null;
  universita?: { nome?: string | null } | null;
  utenti?: { nome_utente?: string | null; nome?: string | null; cognome?: string | null } | null;
};

const mapRoomRowToListing = (row: RoomRow, distanceKm?: number): Listing => {
  const ownerName = row.utenti?.nome_utente ??
    (row.utenti?.nome && row.utenti?.cognome ? `${row.utenti.nome} ${row.utenti.cognome}` : "Unknown");

  const serviziArray = Array.isArray(row.servizi) ? row.servizi : [];
  const furnished = serviziArray.some((servizio: string) =>
    ["arredato", "mobilio", "letto", "armadio"].includes(servizio.toLowerCase())
  );
  const wifi = serviziArray.some((servizio: string) =>
    servizio.toLowerCase().includes("internet")
  );

  return {
    id: row.id,
    title: row.titolo ?? "",
    zone: row.universita?.nome ?? "",
    price: Number(row.prezzo ?? 0),
    owner: ownerName,
    rating: 0,
    photos: 0,
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
  utenti:proprietario_id(nome_utente, nome, cognome)
`;

const router: IRouter = Router();

/**
 * GET /api/listings
 * Returns a list of listings (rooms) with optional filtering.
 */
router.get("/listings", async (req: Request, res: Response) => {
  try {
    const query = ListListingsQueryParams.parse(req.query);

    let dbQuery = supabaseAdmin.from("stanze").select(ROOM_SELECT);

    // Ricerca per università: se conosciamo le sue coordinate cerchiamo per
    // vicinanza (bounding box in SQL, distanza reale in memoria), altrimenti
    // ripieghiamo sul vecchio confronto per nome.
    let university: UniversityPoint | null = null;
    if (query.zone) {
      const { data: matches, error: uniError } = await supabaseAdmin
        .from("universita")
        .select("id, nome, latitudine, longitudine")
        .ilike("nome", `%${query.zone}%`)
        .limit(10);
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
    // TODO: filtro `furnished` (non è una colonna: si ricava da `servizi`).

    dbQuery = dbQuery.eq("attiva", true).eq("stato", "disponibile");

    const { data, error } = await dbQuery;
    if (error) throw error;

    const rows = (data ?? []) as unknown as RoomRow[];
    let listings: Listing[];

    if (university && hasUniversityCoords) {
      const ranked: Array<{ listing: Listing; distance: number | null }> = [];
      for (const row of rows) {
        const hasCoords = row.latitudine != null && row.longitudine != null;
        const distance = hasCoords
          ? haversineKm(
              university.latitudine!,
              university.longitudine!,
              Number(row.latitudine),
              Number(row.longitudine),
            )
          : null;
        const linked = String(row.universita_id ?? "") === String(university.id);
        // Il rettangolo è più largo del cerchio: qui applichiamo il raggio vero.
        if (distance !== null ? distance > SEARCH_RADIUS_KM && !linked : !linked) continue;
        ranked.push({
          listing: mapRoomRowToListing(
            row,
            distance !== null ? Math.round(distance * 10) / 10 : undefined,
          ),
          distance,
        });
      }
      // Più vicine prima; quelle senza coordinate in fondo, poi per prezzo.
      ranked.sort((a, b) => {
        if (a.distance === null && b.distance === null) return a.listing.price - b.listing.price;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
      listings = ranked.map((item) => item.listing);
    } else {
      listings = rows
        .map((row) => mapRoomRowToListing(row))
        .filter(
          (listing) =>
            !query.zone || listing.zone.toLowerCase().includes(query.zone.toLowerCase()),
        );
    }

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
router.get("/listings/:id", async (req: Request, res: Response) => {
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
        utenti:proprietario_id(nome_utente, nome, cognome)
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

    const listing: Listing = mapRoomRowToListing(data as RoomRow);

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
router.post("/listings", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = CreateListingBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dati non validi", details: parsed.error.issues });
    }
    const input = parsed.data;
    const authedReq = req as typeof req & { userId: string; userEmail?: string };

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

    const { error: ownerError } = await supabaseAdmin
      .from("utenti")
      .update({ owner: true })
      .eq("id", authedReq.userId);
    if (ownerError) console.error("Failed to promote listing owner:", ownerError);

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

// The following endpoints (conversations, messages, etc.) are left with mock data for now
// to avoid breaking other parts of the app. They should be updated in a future iteration.

// Mock conversations and messages data (to be replaced with real data later)
const conversations = [
  { id: 1, participant: "user-marco", listingTitle: "Stanza San Lorenzo", preview: "Possiamo fissare una visita?", unread: true, updatedAt: "Oggi, 10:42" },
  { id: 2, participant: "user-anna", listingTitle: "Stanza Fuorigrotta", preview: "Grazie per le informazioni!", unread: false, updatedAt: "Ieri" },
];

const messages = new Map<number, Array<{ id: number; conversationId: number; body: string; sender: string; sentAt: string }>>([
  [1, [
    { id: 1, conversationId: 1, body: "Ciao Marco, sono interessato alla stanza.", sender: "user-student", sentAt: "10:39" },
    { id: 2, conversationId: 1, body: "Ciao! Possiamo fissare una visita questa settimana.", sender: "user-marco", sentAt: "10:42" },
  ]],
  [2, [
    { id: 3, conversationId: 2, body: "È ancora disponibile?", sender: "user-student", sentAt: "Ieri" },
    { id: 4, conversationId: 2, body: "Sì, certo. Ti mando tutti i dettagli.", sender: "user-anna", sentAt: "Ieri" },
  ]],
]);

router.get("/conversations", requireAuth, async (req: Request, res: Response) => {
  const authedReq = req as typeof req & { userId: string; userEmail?: string };
  const userConversations = conversations.filter(conv => conv.participant === authedReq.userId);
  res.json(ListConversationsResponse.parse(userConversations));
});

router.get("/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const { id } = ListMessagesParams.parse({ id: Number(req.params.id) });
  const authedReq = req as typeof req & { userId: string; userEmail?: string };

  const conversation = conversations.find(c => c.id === id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  if (conversation.participant !== authedReq.userId) {
    return res.status(403).json({ error: "Forbidden: You are not a participant in this conversation" });
  }

  return res.json(ListMessagesResponse.parse(messages.get(id) ?? []));
});

router.post("/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const { id } = SendMessageParams.parse({ id: Number(req.params.id) });
  const input = SendMessageBody.parse(req.body);
  const authedReq = req as typeof req & { userId: string; userEmail?: string };

  const conversation = conversations.find(c => c.id === id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  if (conversation.participant === authedReq.userId) {
    return res.status(403).json({ error: "Forbidden: Owners cannot send messages to their own conversations" });
  }

  const existing = messages.get(id) ?? [];
  const message = {
    id: Date.now(),
    conversationId: id,
    body: input.body,
    sender: authedReq.userId,
    sentAt: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
  };
  messages.set(id, [...existing, message]);
  return res.status(201).json(SendMessageResponse.parse(message));
});

router.get("/dashboard/owner", requireAuth, async (req: Request, res: Response) => {
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
router.get("/owner/listings", requireAuth, async (req: Request, res: Response) => {
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
          utenti:proprietario_id(nome_utente, nome, cognome)
        `);

      dbQuery = dbQuery.eq("proprietario_id", authedReq.userId);
      dbQuery = dbQuery.eq("attiva", true);
      dbQuery = dbQuery.eq("stato", "disponibile");

      const { data, error } = await dbQuery;

    if (error) throw error;

    const rows = ((data ?? []) as RoomRow[]);
    const listings: Listing[] = rows.map((row) => mapRoomRowToListing(row));

    return res.json(listings);
  } catch (error) {
    console.error("Error fetching owner listings:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;