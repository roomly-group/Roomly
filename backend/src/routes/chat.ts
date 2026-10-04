import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { messageLimiter } from "../middleware/rateLimit.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import {
  ListConversationsResponse,
  ListMessagesResponse,
  SendMessageBody,
  SendMessageResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const PREVIEW_LENGTH = 120;
const MESSAGES_PAGE = 300;

const IdParam = z.coerce.number().int().positive();
const StartConversationBody = z.object({
  listingId: z.number().int().positive(),
  body: z.string().trim().min(1).max(2000),
});

type PersonRow = { nome_utente?: string | null; nome?: string | null; cognome?: string | null } | null;

type ConversationRow = {
  id: number;
  stanza_id: number;
  updated_at: string;
  stanza?: { titolo?: string | null; proprietario_id: string } | null;
  partecipanti?: Array<{ utente_id: string; utente?: PersonRow }> | null;
  messaggi?: Array<{ testo: string; mittente_id: string; created_at: string }> | null;
};

type MessageRow = {
  id: number;
  conversazione_id: number;
  mittente_id: string;
  testo: string;
  created_at: string;
};

// Tabelle: conversazioni (1 per stanza+studente), conversazioni_utenti
// (i due partecipanti), messaggi. Il proprietario è quello della stanza;
// l'altro partecipante è lo studente.
const CONVERSATION_SELECT = `
  id,
  stanza_id,
  updated_at,
  stanza:stanza_id(titolo, proprietario_id),
  partecipanti:conversazioni_utenti(utente_id, utente:utente_id(nome_utente, nome, cognome)),
  messaggi(testo, mittente_id, created_at)
`;

const displayName = (person: PersonRow | undefined): string => {
  if (!person) return "Utente";
  const full = `${person.nome ?? ""} ${person.cognome ?? ""}`.trim();
  return person.nome_utente || full || "Utente";
};

const ownerIdOf = (conversation: ConversationRow): string | undefined =>
  conversation.stanza?.proprietario_id;

const roleOf = (conversation: ConversationRow, userId: string): "student" | "owner" =>
  ownerIdOf(conversation) === userId ? "owner" : "student";

const toConversation = (row: ConversationRow, userId: string, unreadCount: number) => {
  const other = (row.partecipanti ?? []).find((p) => p.utente_id !== userId);
  const last = row.messaggi?.[0];
  const preview = last?.testo ?? "";
  return {
    id: row.id,
    role: roleOf(row, userId),
    participant: displayName(other?.utente),
    listingTitle: row.stanza?.titolo ?? "",
    preview: preview.length > PREVIEW_LENGTH ? `${preview.slice(0, PREVIEW_LENGTH - 1)}…` : preview,
    unread: unreadCount > 0,
    updatedAt: last?.created_at ?? row.updated_at,
  };
};

const toMessage = (row: MessageRow, conversation: ConversationRow) => ({
  id: row.id,
  conversationId: row.conversazione_id,
  body: row.testo,
  // Ruolo di chi ha scritto nella conversazione: la UI lo confronta col ruolo
  // con cui l'utente sta guardando la chat (studente / proprietario).
  sender: row.mittente_id === ownerIdOf(conversation) ? "owner" : "student",
  sentAt: row.created_at,
});

// Carica la conversazione solo se l'utente ne è partecipante.
async function loadConversationFor(id: number, userId: string) {
  const { data: membership, error: memberError } = await supabaseAdmin
    .from("conversazioni_utenti")
    .select("conversazione_id")
    .eq("conversazione_id", id)
    .eq("utente_id", userId)
    .maybeSingle();
  if (memberError) throw memberError;
  // Stessa risposta di "non esiste": non riveliamo l'esistenza di chat altrui.
  if (!membership) return { status: 404 as const };

  const { data, error } = await supabaseAdmin
    .from("conversazioni")
    .select(CONVERSATION_SELECT)
    .eq("id", id)
    .order("created_at", { referencedTable: "messaggi", ascending: false })
    .limit(1, { referencedTable: "messaggi" })
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: 404 as const };
  return { status: 200 as const, conversation: data as unknown as ConversationRow };
}

// Salva il messaggio e aggiorna l'orario della conversazione (per l'ordinamento).
async function insertMessage(conversationId: number, senderId: string, body: string) {
  const { data, error } = await supabaseAdmin
    .from("messaggi")
    .insert({ conversazione_id: conversationId, mittente_id: senderId, testo: body })
    .select("id, conversazione_id, mittente_id, testo, created_at")
    .single();
  if (error) throw error;
  const message = data as MessageRow;

  const { error: updateError } = await supabaseAdmin
    .from("conversazioni")
    .update({ updated_at: message.created_at })
    .eq("id", conversationId);
  if (updateError) console.error("Failed to bump conversation updated_at:", updateError);

  return message;
}

function serverError(res: Response, label: string, error: unknown) {
  console.error(label, error);
  return res.status(500).json({ error: "Internal server error" });
}

/**
 * GET /api/conversations
 * Tutte le chat in cui l'utente è studente o proprietario, più recenti prima.
 */
router.get("/conversations", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const { data: memberships, error: memberError } = await supabaseAdmin
      .from("conversazioni_utenti")
      .select("conversazione_id")
      .eq("utente_id", userId);
    if (memberError) throw memberError;
    const ids = (memberships ?? []).map((m) => m.conversazione_id as number);
    if (!ids.length) return res.json(ListConversationsResponse.parse([]));

    const [conversationsResult, unreadResult] = await Promise.all([
      supabaseAdmin
        .from("conversazioni")
        .select(CONVERSATION_SELECT)
        .in("id", ids)
        .order("updated_at", { ascending: false })
        .order("created_at", { referencedTable: "messaggi", ascending: false })
        .limit(1, { referencedTable: "messaggi" }),
      supabaseAdmin
        .from("messaggi")
        .select("conversazione_id")
        .in("conversazione_id", ids)
        .eq("letto", false)
        .neq("mittente_id", userId),
    ]);
    if (conversationsResult.error) throw conversationsResult.error;
    if (unreadResult.error) throw unreadResult.error;

    const unread = new Map<number, number>();
    for (const row of unreadResult.data ?? []) {
      const key = row.conversazione_id as number;
      unread.set(key, (unread.get(key) ?? 0) + 1);
    }

    const rows = (conversationsResult.data ?? []) as unknown as ConversationRow[];
    return res.json(
      ListConversationsResponse.parse(rows.map((row) => toConversation(row, userId, unread.get(row.id) ?? 0))),
    );
  } catch (error) {
    return serverError(res, "Error listing conversations:", error);
  }
});

/**
 * POST /api/conversations
 * Avvia (o riapre) la chat con il proprietario di un annuncio e invia il
 * primo messaggio. Usato dal pulsante "Scrivi a…" nel dettaglio annuncio.
 */
router.post("/conversations", requireAuth, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const parsed = StartConversationBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dati non validi", details: parsed.error.issues });
  }
  const { listingId, body } = parsed.data;

  try {
    const { data: room, error: roomError } = await supabaseAdmin
      .from("stanze")
      .select("id, proprietario_id, attiva")
      .eq("id", listingId)
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room || !room.attiva || !room.proprietario_id) {
      return res.status(404).json({ error: "Listing not found" });
    }
    if (room.proprietario_id === userId) {
      return res.status(400).json({ error: "Non puoi scrivere a te stesso" });
    }

    // Chat già esistente per questa stanza e questo studente?
    const { data: mine, error: mineError } = await supabaseAdmin
      .from("conversazioni_utenti")
      .select("conversazione_id")
      .eq("utente_id", userId);
    if (mineError) throw mineError;
    const myIds = (mine ?? []).map((m) => m.conversazione_id as number);

    let conversationId: number | null = null;
    if (myIds.length) {
      const { data: existing, error: findError } = await supabaseAdmin
        .from("conversazioni")
        .select("id")
        .eq("stanza_id", listingId)
        .in("id", myIds)
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;
      conversationId = existing?.id ?? null;
    }

    if (conversationId === null) {
      const { data: created, error: createError } = await supabaseAdmin
        .from("conversazioni")
        .insert({ stanza_id: listingId })
        .select("id")
        .single();
      if (createError) throw createError;
      conversationId = created.id as number;

      const { error: membersError } = await supabaseAdmin.from("conversazioni_utenti").insert([
        { conversazione_id: conversationId, utente_id: userId },
        { conversazione_id: conversationId, utente_id: room.proprietario_id },
      ]);
      if (membersError) {
        // Non lasciamo una conversazione senza partecipanti.
        await supabaseAdmin.from("conversazioni").delete().eq("id", conversationId);
        throw membersError;
      }
    }

    await insertMessage(conversationId, userId, body);
    return res.status(201).json({ conversationId });
  } catch (error) {
    return serverError(res, "Error starting conversation:", error);
  }
});

/**
 * GET /api/conversations/:id/messages
 * Messaggi della chat (i più vecchi prima). Segna la chat come letta per chi la apre.
 */
router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = IdParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid conversation id" });

  try {
    const found = await loadConversationFor(id.data, userId);
    if (found.status !== 200) return res.status(404).json({ error: "Conversation not found" });
    const { conversation } = found;

    // Prendiamo gli ultimi N messaggi e li rimettiamo in ordine cronologico.
    const { data, error } = await supabaseAdmin
      .from("messaggi")
      .select("id, conversazione_id, mittente_id, testo, created_at")
      .eq("conversazione_id", id.data)
      .order("id", { ascending: false })
      .limit(MESSAGES_PAGE);
    if (error) throw error;

    const rows = ((data ?? []) as MessageRow[]).reverse();

    // Segna come letti i messaggi dell'altra persona.
    const { error: readError } = await supabaseAdmin
      .from("messaggi")
      .update({ letto: true })
      .eq("conversazione_id", id.data)
      .neq("mittente_id", userId)
      .eq("letto", false);
    if (readError) console.error("Failed to mark messages as read:", readError);

    return res.json(ListMessagesResponse.parse(rows.map((row) => toMessage(row, conversation))));
  } catch (error) {
    return serverError(res, "Error listing messages:", error);
  }
});

/**
 * POST /api/conversations/:id/messages
 * Invia un messaggio in una chat di cui si è partecipanti (studente o proprietario).
 */
router.post("/conversations/:id/messages", requireAuth, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = IdParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid conversation id" });

  const input = SendMessageBody.safeParse(req.body);
  const body = input.success ? input.data.body.trim() : "";
  if (!body || body.length > 2000) {
    return res.status(400).json({ error: "Messaggio non valido (1–2000 caratteri)" });
  }

  try {
    const found = await loadConversationFor(id.data, userId);
    if (found.status !== 200) return res.status(404).json({ error: "Conversation not found" });
    const { conversation } = found;

    const message = await insertMessage(id.data, userId, body);
    return res.status(201).json(SendMessageResponse.parse(toMessage(message, conversation)));
  } catch (error) {
    return serverError(res, "Error sending message:", error);
  }
});

export default router;
