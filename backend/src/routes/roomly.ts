import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import {
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
  type Listing,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Columns of `stanze` plus the two related rows we need. The university name
// lives in the `universita` table, reached through stanze.universita_id, so it
// has to be embedded as `universita:universita_id(nome)` (NOT `universita:nome`,
// which asks for a column that does not exist and makes the whole query fail).
const LISTING_COLUMNS = `
  id,
  titolo,
  prezzo,
  descrizione,
  attiva,
  stato,
  servizi,
  universita_id,
  proprietario_id,
  utenti:proprietario_id(nome_utente, nome, cognome)
`;
const LISTING_SELECT = `${LISTING_COLUMNS}, universita:universita_id(nome)`;
// `!inner` turns the embed into an INNER JOIN so that filtering on
// universita.nome actually removes non-matching rooms.
const LISTING_SELECT_INNER = `${LISTING_COLUMNS}, universita:universita_id!inner(nome)`;

// PostgREST returns an embedded row as an object for many-to-one relations but
// as an array for one-to-many ones; accept both.
function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapListing(row: any): Listing {
  const owner = first<{ nome_utente?: string; nome?: string; cognome?: string }>(row.utenti);
  const uni = first<{ nome?: string }>(row.universita);

  const ownerName =
    owner?.nome_utente ||
    (owner?.nome && owner?.cognome ? `${owner.nome} ${owner.cognome}` : "Unknown");

  const servizi: string[] = Array.isArray(row.servizi)
    ? row.servizi.map((s: unknown) => String(s).toLowerCase())
    : [];

  return {
    id: Number(row.id),
    title: row.titolo ?? "",
    zone: uni?.nome ?? "",
    price: Number(row.prezzo),
    owner: ownerName,
    rating: 0, // placeholder
    photos: 0, // TODO: count stanze_foto
    furnished: servizi.some((s) => ["arredato", "mobilio", "letto", "armadio"].includes(s)),
    wifi: servizi.some((s) => s.includes("internet") || s.includes("wifi")),
    description: row.descrizione ?? "",
    available: Boolean(row.attiva) && row.stato === "disponibile",
  };
}

/**
 * GET /api/listings
 * Returns a list of listings (rooms) with optional filtering.
 */
router.get("/listings", async (req: Request, res: Response) => {
  try {
    const query = ListListingsQueryParams.parse(req.query);

    let dbQuery = supabaseAdmin
      .from("stanze")
      .select(query.zone ? LISTING_SELECT_INNER : LISTING_SELECT)
      .eq("attiva", true)
      .eq("stato", "disponibile");

    if (query.zone) {
      dbQuery = dbQuery.ilike("universita.nome", `%${query.zone}%`);
    }
    if (query.maxPrice !== undefined) {
      dbQuery = dbQuery.lte("prezzo", query.maxPrice);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;

    let listings = (data ?? []).map(mapListing);

    // `furnished` is derived from the `servizi` array, so filter after mapping.
    if (query.furnished) {
      listings = listings.filter((listing) => listing.furnished);
    }

    res.json(ListListingsResponse.parse(listings));
  } catch (error) {
    console.error("Error fetching listings:", error);
    res.status(500).json({ error: "Internal server error" });
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
      .select(LISTING_SELECT)
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

    const listing = mapListing(data);

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
    const input = CreateListingBody.parse(req.body);
    const authedReq = req as typeof req & { userId: string; userEmail?: string };

    // We need to insert into the stanze table
    // But we don't have a direct mapping from input to all columns.
    // We'll need to map the input fields to the database columns.
    // For now, we'll insert a minimal set and note that more work is needed.
    // This is a draft implementation.

    // Determine the universita_id from the zone? Not provided in input.
    // The input has a 'zone' field, which we expect to be a university name.
    // We need to look up the universita id by name.
    let universitaId: string | null = null;
    if (input.zone) {
      const { data: uniData, error: uniError } = await supabaseAdmin
        .from("universita")
        .select("id")
        .eq("nome", input.zone)
        .single();

      if (uniError && uniError.code !== "PGRST116") {
        throw uniError;
      }
      if (uniData) {
        universitaId = uniData.id;
      }
    }

    // Insert the new listing
    const { data: newListing, error: insertError } = await supabaseAdmin
      .from("stanze")
      .insert({
        titolo: input.title,
        descrizione: input.description,
        prezzo: input.price,
        // zone is not a column; we have universita_id and citta
        // We'll set citta to null for now, or we could get it from the universita record.
        citta: null, // TODO: get citta from universita if needed
        universita_id: universitaId,
        proprietario_id: authedReq.userId, // assuming userId matches the utenti id
        // servizi: we need to set based on furnished and wifi? Not directly.
        // We'll set servizi as an empty array for now.
        servizi: [],
        attiva: true,
        stato: "disponibile",
      })
      .select()
      .single();

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
      zone: input.zone, // we don't have the university name yet, but we can fetch it
      price: Number(newListing.prezzo),
      owner: authedReq.userId, // TODO: get actual name
      rating: 0,
      photos: 0,
      furnished: input.furnished ?? false,
      wifi: input.wifi ?? false,
      description: newListing.descrizione ?? "",
      available: newListing.attiva && newListing.stato === "disponibile",
    };

    res.status(201).json(CreateListingResponse.parse(listing));
  } catch (error) {
    console.error("Error creating listing:", error);
    res.status(500).json({ error: "Internal server error" });
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
  res.json(GetOwnerDashboardResponse.parse({
    activeListings: 0,
    pendingRequests: 0,
    activeChats: 0,
    monthlyEarnings: 0,
    averageRating: 0,
  }));
});

export default router;