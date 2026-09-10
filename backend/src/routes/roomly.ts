import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
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
} from "@workspace/api-zod";

const router: IRouter = Router();

type Listing = {
  id: number;
  title: string;
  zone: string;
  price: number;
  owner: string;
  rating: number;
  photos: number;
  furnished: boolean;
  wifi: boolean;
  description: string;
  available: boolean;
};

let listings: Listing[] = [
  {
    id: 1,
    title: "Stanza luminosa a San Lorenzo",
    zone: "San Lorenzo",
    price: 450,
    owner: "user-marco",
    rating: 4.8,
    photos: 3,
    furnished: true,
    wifi: true,
    description: "Luminosa e tranquilla, a pochi minuti dall'università.",
    available: true,
  },
  {
    id: 2,
    title: "Stanza moderna a Fuorigrotta",
    zone: "Fuorigrotta",
    price: 380,
    owner: "user-anna",
    rating: 4.6,
    photos: 4,
    furnished: true,
    wifi: true,
    description: "Casa condivisa moderna, metro a 5 minuti a piedi.",
    available: true,
  },
  {
    id: 3,
    title: "Stanza con vista al Vomero",
    zone: "Vomero",
    price: 520,
    owner: "user-paolo",
    rating: 4.9,
    photos: 5,
    furnished: true,
    wifi: true,
    description: "Panorama sulla città, ambiente silenzioso e curato.",
    available: true,
  },
];

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

router.get("/listings", (req, res) => {
  const query = ListListingsQueryParams.parse(req.query);
  const result = listings.filter((listing) =>
    (!query.zone || listing.zone.toLowerCase().includes(query.zone.toLowerCase())) &&
    (query.maxPrice === undefined || listing.price <= query.maxPrice) &&
    (query.furnished === undefined || listing.furnished === query.furnished),
  );
  res.json(ListListingsResponse.parse(result));
});

router.post("/listings", requireAuth, (req, res) => {
  const input = CreateListingBody.parse(req.body);
  const authedReq = req as typeof req & { userId: string; userEmail?: string };
  const listing: Listing = {
    id: Math.max(...listings.map((item) => item.id), 0) + 1,
    title: input.title,
    zone: input.zone,
    price: input.price,
    owner: authedReq.userId, // Use authenticated user's ID as owner
    rating: 0,
    photos: input.photos ?? 0,
    furnished: input.furnished ?? false,
    wifi: input.wifi ?? false,
    description: input.description,
    available: true,
  };
  listings = [listing, ...listings];
  res.status(201).json(CreateListingResponse.parse(listing));
});

router.get("/listings/:id", (req, res) => {
  const { id } = GetListingParams.parse({ id: Number(req.params.id) });
  const listing = listings.find((item) => item.id === id);
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  return res.json(GetListingResponse.parse(listing));
});

router.get("/conversations", requireAuth, (req, res) => {
  const authedReq = req as typeof req & { userId: string; userEmail?: string };
  // Filter conversations to only those where the authenticated user is the participant
  const userConversations = conversations.filter(conv => conv.participant === authedReq.userId);
  res.json(ListConversationsResponse.parse(userConversations));
});

router.get("/conversations/:id/messages", requireAuth, (req, res) => {
  const { id } = ListMessagesParams.parse({ id: Number(req.params.id) });
  const authedReq = req as typeof req & { userId: string; userEmail?: string };

  // Find the conversation
  const conversation = conversations.find(c => c.id === id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // Check if the authenticated user is the participant in this conversation
  if (conversation.participant !== authedReq.userId) {
    return res.status(403).json({ error: "Forbidden: You are not a participant in this conversation" });
  }

  res.json(ListMessagesResponse.parse(messages.get(id) ?? []));
});

router.post("/conversations/:id/messages", requireAuth, (req, res) => {
  const { id } = SendMessageParams.parse({ id: Number(req.params.id) });
  const input = SendMessageBody.parse(req.body);
  const authedReq = req as typeof req & { userId: string; userEmail?: string };

  // Find the conversation
  const conversation = conversations.find(c => c.id === id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // Check if the authenticated user is NOT the owner (they should be a student)
  // In our mock data, owners have IDs like "user-marco", "user-anna"
  // Students would have different IDs like "user-student"
  if (conversation.participant === authedReq.userId) {
    return res.status(403).json({ error: "Forbidden: Owners cannot send messages to their own conversations" });
  }

  const existing = messages.get(id) ?? [];
  const message = {
    id: Date.now(),
    conversationId: id,
    body: input.body,
    sender: authedReq.userId, // Use the authenticated user's ID as sender
    sentAt: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
  };
  messages.set(id, [...existing, message]);
  res.status(201).json(SendMessageResponse.parse(message));
});

router.get("/dashboard/owner", requireAuth, (req, res) => {
  const authedReq = req as typeof req & { userId: string; userEmail?: string };

  // Filter listings to only those owned by the authenticated user
  const userListings = listings.filter(listing => listing.owner === authedReq.userId);

  // Calculate average rating for user's listings
  const totalRating = userListings.reduce((sum, listing) => sum + listing.rating, 0);
  const averageRating = userListings.length > 0 ? totalRating / userListings.length : 0;

  res.json(GetOwnerDashboardResponse.parse({
    activeListings: userListings.length,
    pendingRequests: 3, // This would ideally be calculated from requests to user's listings
    activeChats: conversations.filter(conv => conv.participant === authedReq.userId).length,
    monthlyEarnings: 1450, // This would ideally be calculated from user's listings
    averageRating: Number(averageRating.toFixed(1)),
  }));
});

export default router;