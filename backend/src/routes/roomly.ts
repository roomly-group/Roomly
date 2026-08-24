import { Router, type IRouter } from "express";
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
    owner: "Marco",
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
    owner: "Anna",
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
    owner: "Paolo",
    rating: 4.9,
    photos: 5,
    furnished: true,
    wifi: true,
    description: "Panorama sulla città, ambiente silenzioso e curato.",
    available: true,
  },
];

const conversations = [
  { id: 1, participant: "Marco Bianchi", listingTitle: "Stanza San Lorenzo", preview: "Possiamo fissare una visita?", unread: true, updatedAt: "Oggi, 10:42" },
  { id: 2, participant: "Anna Verdi", listingTitle: "Stanza Fuorigrotta", preview: "Grazie per le informazioni!", unread: false, updatedAt: "Ieri" },
];

const messages = new Map<number, Array<{ id: number; conversationId: number; body: string; sender: string; sentAt: string }>>([
  [1, [
    { id: 1, conversationId: 1, body: "Ciao Marco, sono interessato alla stanza.", sender: "student", sentAt: "10:39" },
    { id: 2, conversationId: 1, body: "Ciao! Possiamo fissare una visita questa settimana.", sender: "owner", sentAt: "10:42" },
  ]],
  [2, [
    { id: 3, conversationId: 2, body: "È ancora disponibile?", sender: "student", sentAt: "Ieri" },
    { id: 4, conversationId: 2, body: "Sì, certo. Ti mando tutti i dettagli.", sender: "owner", sentAt: "Ieri" },
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

router.post("/listings", (req, res) => {
  const input = CreateListingBody.parse(req.body);
  const listing: Listing = {
    id: Math.max(...listings.map((item) => item.id), 0) + 1,
    title: input.title,
    zone: input.zone,
    price: input.price,
    owner: "Tu",
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

router.get("/conversations", (_req, res) => {
  res.json(ListConversationsResponse.parse(conversations));
});

router.get("/conversations/:id/messages", (req, res) => {
  const { id } = ListMessagesParams.parse({ id: Number(req.params.id) });
  res.json(ListMessagesResponse.parse(messages.get(id) ?? []));
});

router.post("/conversations/:id/messages", (req, res) => {
  const { id } = SendMessageParams.parse({ id: Number(req.params.id) });
  const input = SendMessageBody.parse(req.body);
  const existing = messages.get(id) ?? [];
  const message = {
    id: Date.now(),
    conversationId: id,
    body: input.body,
    sender: "student",
    sentAt: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
  };
  messages.set(id, [...existing, message]);
  res.status(201).json(SendMessageResponse.parse(message));
});

router.get("/dashboard/owner", (_req, res) => {
  res.json(GetOwnerDashboardResponse.parse({
    activeListings: listings.length,
    pendingRequests: 3,
    activeChats: conversations.length,
    monthlyEarnings: 1450,
    averageRating: 4.8,
  }));
});

export default router;