import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import { forgetUser, requireAdmin, requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { messageLimiter, reportLimiter } from "../middleware/rateLimit.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { BLOCKS_TABLE } from "../lib/blocks.js";
import { logger } from "../lib/logger.js";
import {
  ADMIN_REPORT_MESSAGES_LIMIT,
  ADMIN_REPORTS_PAGE_SIZE,
  API_ROUTE_PATHS,
  AdminListingVisibilityBody,
  AdminReportMessagesResponse,
  AdminUserStatusBody,
  CreateReportBody,
  DELETED_MESSAGE_TYPE,
  ListAdminReportsResponse,
  ReportStatusSchema,
  ResolveReportBody,
  SAFETY_ERROR_CODES,
  type AdminReport,
  type ReportReason,
  type ReportStatus,
  type ReportTarget,
} from "@workspace/api-zod";

// Safety tools (audit finding RMY-12).
//   Users:  POST /reports (report a chat partner, a message or a listing),
//           POST / DELETE /conversations/:id/block (block or unblock the other
//           person of a chat). A user never acts on anyone else: a report only
//           lands in the admin queue, a block only closes their own chats.
//   Admins: the report queue, the reported chat, and the actions: suspend or
//           reactivate an account, hide or show a listing, close a report.
// Tables: segnalazioni, blocchi_utenti (migrations/019_segnalazioni_blocchi.sql).

// ===================== CONFIGURATION =====================

/** Table holding the reports. */
const REPORTS_TABLE = "segnalazioni" as const;
/** API target name → `segnalazioni.tipo`. */
const TARGET_TO_DB = { user: "utente", message: "messaggio", listing: "annuncio" } as const satisfies Record<ReportTarget, string>;
/** `segnalazioni.tipo` → API target name. */
const DB_TO_TARGET: Record<string, ReportTarget> = { utente: "user", messaggio: "message", annuncio: "listing" };
/** `utenti.stato` of an account that may use the app. */
const ACCOUNT_ACTIVE = "attivo" as const;
/** `utenti.stato` set by an admin; migration 017 also bans the account in Supabase Auth. */
const ACCOUNT_SUSPENDED = "sospeso" as const;
/** `utenti.stato` of a deleted account: never changed from here. */
const ACCOUNT_DELETED = "eliminato" as const;
/** Postgres error code of a unique-index violation (an open report already exists). */
const UNIQUE_VIOLATION_CODE = "23505" as const;
/** Message type of a normal text (`messaggi.tipo`); only these can be reported. */
const TEXT_MESSAGE_TYPE = "testo" as const;
/** Message type of a request notice (`messaggi.tipo`). */
const SYSTEM_MESSAGE_TYPE = "sistema" as const;

const router: IRouter = Router();

const IdParam = z.coerce.number().int().positive();
const UserIdParam = z.string().uuid();
const AdminListQuery = z.object({ status: ReportStatusSchema.optional() });

type Person = { id?: string; nome_utente?: string | null; nome?: string | null; cognome?: string | null; email?: string | null } | null;

// ===================== HELPERS =====================

const displayName = (person: Person | undefined) =>
  `${person?.nome ?? ""} ${person?.cognome ?? ""}`.trim() || person?.nome_utente || "—";

function serverError(res: Response, label: string, error: unknown) {
  console.error(label, error);
  return res.status(500).json({ error: "Internal server error" });
}

/**
 * The two people of a chat, seen from `userId`. Null when the chat does not
 * exist or the user is neither its student nor the room owner (same answer
 * either way: we never reveal other people's chats).
 * `otherId` is null when the other person deleted their account.
 */
async function loadChatPair(conversationId: number, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("conversazioni")
    .select("id, stanza_id, studente_id, stanza:stanza_id(proprietario_id)")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as { stanza_id: number; studente_id: string | null; stanza: { proprietario_id: string | null } | null };
  const ownerId = row.stanza?.proprietario_id ?? null;
  const isOwner = ownerId === userId;
  const isStudent = row.studente_id === userId;
  if (!isOwner && !isStudent) return null;
  return { otherId: isOwner ? row.studente_id : ownerId, ownerId, roomId: row.stanza_id };
}

// ===================== USER ROUTES =====================

/**
 * POST /api/reports
 * Files a report. The backend works out who is reported from the chat, the
 * message or the listing, so nobody can report a user they never dealt with.
 * Pressing "Report" twice on the same thing keeps a single open report.
 */
router.post(API_ROUTE_PATHS.REPORTS, requireAuth, reportLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid report" });
  const body = parsed.data;
  const notReportable = () => res.status(409).json({ error: "This can't be reported", code: SAFETY_ERROR_CODES.NOT_REPORTABLE });

  try {
    let target: Record<string, unknown>;

    if (body.target === "user") {
      const pair = await loadChatPair(body.conversationId, userId);
      if (!pair) return res.status(404).json({ error: "Conversation not found" });
      if (!pair.otherId) return notReportable();
      target = {
        utente_segnalato_id: pair.otherId,
        conversazione_id: body.conversationId,
        // The listing only when it belongs to the reported person (an owner reporting a student keeps their own room out of it).
        stanza_id: pair.otherId === pair.ownerId ? pair.roomId : null,
      };
    } else if (body.target === "message") {
      const { data: message, error } = await supabaseAdmin
        .from("messaggi")
        .select("id, conversazione_id, mittente_id, testo, tipo")
        .eq("id", body.messageId)
        .maybeSingle();
      if (error) throw error;
      if (!message) return res.status(404).json({ error: "Message not found" });
      const pair = await loadChatPair(message.conversazione_id as number, userId);
      if (!pair) return res.status(404).json({ error: "Message not found" });
      // Only the other person's own texts: not system notices, deleted texts or your own messages.
      if (message.tipo !== TEXT_MESSAGE_TYPE || !message.mittente_id || message.mittente_id === userId) return notReportable();
      target = {
        utente_segnalato_id: message.mittente_id,
        conversazione_id: message.conversazione_id,
        messaggio_id: message.id,
        testo_messaggio: message.testo,
        stanza_id: message.mittente_id === pair.ownerId ? pair.roomId : null,
      };
    } else {
      const { data: room, error } = await supabaseAdmin
        .from("stanze")
        .select("id, proprietario_id, attiva")
        .eq("id", body.listingId)
        .maybeSingle();
      if (error) throw error;
      // Hidden listings are not visible, so they cannot be reported either.
      if (!room || !room.attiva) return res.status(404).json({ error: "Listing not found" });
      if (room.proprietario_id === userId) return notReportable();
      target = { utente_segnalato_id: room.proprietario_id, stanza_id: room.id };
    }

    const { error: insertError } = await supabaseAdmin.from(REPORTS_TABLE).insert({
      ...target,
      segnalante_id: userId,
      tipo: TARGET_TO_DB[body.target],
      motivo: body.reason,
      descrizione: body.description || null,
    });
    if (insertError) {
      // Already reported and still open: nothing new to store, same happy answer.
      if ((insertError as { code?: string }).code === UNIQUE_VIOLATION_CODE) return res.status(200).json({ success: true });
      throw insertError;
    }
    return res.status(201).json({ success: true });
  } catch (error) {
    return serverError(res, "Error filing report:", error);
  }
});

/**
 * POST /api/conversations/:id/block
 * Blocks the other person of the chat: no messages and no new requests
 * between the two from now on (checked in routes/chat.ts).
 */
router.post(API_ROUTE_PATHS.CONVERSATION_BLOCK, requireAuth, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = IdParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid conversation id" });

  try {
    const pair = await loadChatPair(id.data, userId);
    if (!pair) return res.status(404).json({ error: "Conversation not found" });
    if (!pair.otherId) return res.status(409).json({ error: "Nobody to block", code: SAFETY_ERROR_CODES.NOT_REPORTABLE });
    const { error } = await supabaseAdmin
      .from(BLOCKS_TABLE)
      .upsert({ bloccante_id: userId, bloccato_id: pair.otherId }, { onConflict: "bloccante_id,bloccato_id", ignoreDuplicates: true });
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    return serverError(res, "Error blocking user:", error);
  }
});

/**
 * DELETE /api/conversations/:id/block
 * Lifts the block the user put on the other person of the chat. A block the
 * other person put on the user is not touched.
 */
router.delete(API_ROUTE_PATHS.CONVERSATION_BLOCK, requireAuth, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = IdParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid conversation id" });

  try {
    const pair = await loadChatPair(id.data, userId);
    if (!pair) return res.status(404).json({ error: "Conversation not found" });
    if (pair.otherId) {
      const { error } = await supabaseAdmin
        .from(BLOCKS_TABLE)
        .delete()
        .eq("bloccante_id", userId)
        .eq("bloccato_id", pair.otherId);
      if (error) throw error;
    }
    return res.json({ success: true });
  } catch (error) {
    return serverError(res, "Error unblocking user:", error);
  }
});

// ===================== ADMIN ROUTES =====================

type ReportRow = {
  id: number;
  tipo: string;
  motivo: ReportReason;
  descrizione: string | null;
  stato: ReportStatus;
  created_at: string;
  conversazione_id: number | null;
  testo_messaggio: string | null;
  gestita_at: string | null;
  nota_admin: string | null;
  segnalante: Person;
  segnalato: (Person & { stato?: string | null; admin?: boolean | null }) | null;
  stanza: { id: number; titolo: string | null; attiva: boolean | null } | null;
};

/**
 * GET /api/admin/reports?status=aperta
 * Reports with the given status (default: open, oldest first), with the
 * people and the listing involved, and how often the reported person was
 * reported in total.
 */
router.get(API_ROUTE_PATHS.ADMIN_REPORTS, requireAuth, requireAdmin, async (req, res) => {
  const query = AdminListQuery.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: "Invalid filter" });
  const status = query.data.status ?? "aperta";
  res.set("Cache-Control", "no-store");

  try {
    const [list, open] = await Promise.all([
      supabaseAdmin
        .from(REPORTS_TABLE)
        .select(
          `id, tipo, motivo, descrizione, stato, created_at, conversazione_id, testo_messaggio, gestita_at, nota_admin,
           segnalante:segnalante_id(id, nome_utente, nome, cognome, email),
           segnalato:utente_segnalato_id(id, nome_utente, nome, cognome, email, stato, admin),
           stanza:stanza_id(id, titolo, attiva)`,
        )
        .eq("stato", status)
        .order(status === "aperta" ? "created_at" : "gestita_at", { ascending: status === "aperta" })
        .limit(ADMIN_REPORTS_PAGE_SIZE),
      supabaseAdmin.from(REPORTS_TABLE).select("id", { count: "exact", head: true }).eq("stato", "aperta"),
    ]);
    if (list.error) throw list.error;
    if (open.error) throw open.error;
    const rows = (list.data ?? []) as unknown as ReportRow[];

    // Total reports per reported person, in one query for the whole page.
    const reportedIds = [...new Set(rows.map((row) => row.segnalato?.id).filter((id): id is string => Boolean(id)))];
    const totals = new Map<string, number>();
    if (reportedIds.length) {
      const { data, error } = await supabaseAdmin.from(REPORTS_TABLE).select("utente_segnalato_id").in("utente_segnalato_id", reportedIds);
      if (error) throw error;
      for (const row of (data ?? []) as Array<{ utente_segnalato_id: string }>) {
        totals.set(row.utente_segnalato_id, (totals.get(row.utente_segnalato_id) ?? 0) + 1);
      }
    }

    const items: AdminReport[] = rows.map((row) => ({
      id: row.id,
      target: DB_TO_TARGET[row.tipo] ?? "user",
      reason: row.motivo,
      description: row.descrizione,
      status: row.stato,
      createdAt: row.created_at,
      reporter: row.segnalante?.id
        ? { id: row.segnalante.id, name: displayName(row.segnalante), email: row.segnalante.email ?? null }
        : null,
      reportedUser: row.segnalato?.id
        ? {
            id: row.segnalato.id,
            name: displayName(row.segnalato),
            email: row.segnalato.email ?? null,
            accountStatus: row.segnalato.stato ?? ACCOUNT_ACTIVE,
            isAdmin: row.segnalato.admin === true,
            totalReports: totals.get(row.segnalato.id) ?? 1,
          }
        : null,
      listing: row.stanza ? { id: row.stanza.id, title: row.stanza.titolo ?? "", active: row.stanza.attiva === true } : null,
      conversationId: row.conversazione_id,
      messageText: row.testo_messaggio,
      handledAt: row.gestita_at,
      adminNote: row.nota_admin,
    }));

    return res.json(ListAdminReportsResponse.parse({ items, openCount: open.count ?? 0 }));
  } catch (error) {
    return serverError(res, "Error listing reports:", error);
  }
});

/**
 * GET /api/admin/reports/:id/messages
 * The chat a report came from (its latest messages, oldest first), so the
 * admin can judge it. Only the chat of that report, never any other one.
 */
router.get(API_ROUTE_PATHS.ADMIN_REPORT_MESSAGES, requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = IdParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid report id" });
  res.set("Cache-Control", "no-store");

  try {
    const { data: report, error: reportError } = await supabaseAdmin
      .from(REPORTS_TABLE)
      .select("id, conversazione_id, utente_segnalato_id")
      .eq("id", id.data)
      .maybeSingle();
    if (reportError) throw reportError;
    if (!report?.conversazione_id) return res.status(404).json({ error: "No conversation for this report" });

    const { data, error } = await supabaseAdmin
      .from("messaggi")
      .select("id, mittente_id, testo, tipo, created_at")
      .eq("conversazione_id", report.conversazione_id)
      .order("id", { ascending: false })
      .limit(ADMIN_REPORT_MESSAGES_LIMIT);
    if (error) throw error;

    // Audit trail: which admin read which reported chat (ids only, no content).
    logger.info({ adminId: userId, reportId: report.id }, "Admin opened a reported conversation");

    type Row = { id: number; mittente_id: string | null; testo: string; tipo: string; created_at: string };
    const messages = ((data ?? []) as Row[]).reverse().map((message) => {
      const deleted = message.tipo === DELETED_MESSAGE_TYPE || (!message.mittente_id && message.tipo !== SYSTEM_MESSAGE_TYPE);
      return {
        id: message.id,
        from: message.tipo === SYSTEM_MESSAGE_TYPE
          ? ("system" as const)
          : deleted
            ? ("deleted" as const)
            : message.mittente_id === report.utente_segnalato_id
              ? ("reported" as const)
              : ("reporter" as const),
        body: deleted ? "" : message.testo,
        sentAt: message.created_at,
      };
    });
    return res.json(AdminReportMessagesResponse.parse(messages));
  } catch (error) {
    return serverError(res, "Error reading reported conversation:", error);
  }
});

/**
 * POST /api/admin/reports/:id/resolve
 * Closes an open report: 'risolta' (action taken) or 'archiviata' (nothing to
 * do), with an optional internal note. Never shown to the users.
 */
router.post(API_ROUTE_PATHS.ADMIN_REPORT_RESOLVE, requireAuth, requireAdmin, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = IdParam.safeParse(req.params.id);
  const body = ResolveReportBody.safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ error: "Invalid decision" });

  try {
    const { data, error } = await supabaseAdmin
      .from(REPORTS_TABLE)
      .update({
        stato: body.data.status,
        nota_admin: body.data.note || null,
        gestita_da: userId,
        gestita_at: new Date().toISOString(),
      })
      .eq("id", id.data)
      .eq("stato", "aperta")
      .select("id");
    if (error) throw error;
    if (!data?.length) return res.status(409).json({ error: "This report is already closed" });
    return res.json({ success: true });
  } catch (error) {
    return serverError(res, "Error closing report:", error);
  }
});

/**
 * POST /api/admin/users/:id/status   body: { suspended: boolean }
 * Suspends or reactivates an account. Migration 017 bans a suspended account
 * in Supabase Auth and ends its sessions; forgetUser drops this server's
 * cached tokens, so the change applies at once. Admins cannot be suspended
 * from here (nor can an admin suspend themselves), and deleted accounts are
 * never touched.
 */
router.post(API_ROUTE_PATHS.ADMIN_USER_STATUS, requireAuth, requireAdmin, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = UserIdParam.safeParse(req.params.id);
  const body = AdminUserStatusBody.safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ error: "Invalid request" });
  if (id.data === userId) {
    return res.status(409).json({ error: "You can't change your own account", code: SAFETY_ERROR_CODES.PROTECTED_ACCOUNT });
  }

  try {
    const { data: account, error } = await supabaseAdmin.from("utenti").select("stato, admin").eq("id", id.data).maybeSingle();
    if (error) throw error;
    if (!account || account.stato === ACCOUNT_DELETED) return res.status(404).json({ error: "User not found" });
    if (account.admin === true) {
      return res.status(409).json({ error: "Admin accounts can't be suspended here", code: SAFETY_ERROR_CODES.PROTECTED_ACCOUNT });
    }

    const next = body.data.suspended ? ACCOUNT_SUSPENDED : ACCOUNT_ACTIVE;
    const { error: updateError } = await supabaseAdmin
      .from("utenti")
      .update({ stato: next, updated_at: new Date().toISOString() })
      .eq("id", id.data)
      .neq("stato", ACCOUNT_DELETED);
    if (updateError) throw updateError;
    forgetUser(id.data);
    logger.info({ adminId: userId, targetId: id.data, status: next }, "Admin changed account status");
    return res.json({ success: true, accountStatus: next });
  } catch (error) {
    return serverError(res, "Error changing account status:", error);
  }
});

/**
 * POST /api/admin/listings/:id/visibility   body: { active: boolean }
 * Hides a listing (stanze.attiva = false: gone from search, detail page and
 * new requests) or shows it again. Owners cannot change this flag themselves.
 */
router.post(API_ROUTE_PATHS.ADMIN_LISTING_VISIBILITY, requireAuth, requireAdmin, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = IdParam.safeParse(req.params.id);
  const body = AdminListingVisibilityBody.safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ error: "Invalid request" });

  try {
    const { data, error } = await supabaseAdmin
      .from("stanze")
      .update({ attiva: body.data.active, updated_at: new Date().toISOString() })
      .eq("id", id.data)
      .select("id");
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ error: "Listing not found" });
    logger.info({ adminId: userId, listingId: id.data, active: body.data.active }, "Admin changed listing visibility");
    return res.json({ success: true, active: body.data.active });
  } catch (error) {
    return serverError(res, "Error changing listing visibility:", error);
  }
});

export default router;
