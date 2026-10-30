import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { messageLimiter } from "../middleware/rateLimit.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { releaseRoom } from "../lib/rooms.js";
import {
  API_ROUTE_PATHS,
  CONTRACT_EXPIRING_WINDOW_DAYS,
  CONTRACT_REGISTRATION_DEADLINE_DAYS,
  CreateOwnerContractBody,
  ListOwnerContractsResponse,
  UpdateOwnerContractStatusBody,
  type ContractGroup,
  type ContractStatus,
  type OwnerContractItem,
} from "@workspace/api-zod";

// ===================== CONFIGURATION =====================

/** Time zone used to decide what "today" is for deadlines and expiries. */
const CONTRACTS_TIME_ZONE = "Europe/Rome" as const;
/** File name offered when the owner exports contracts for the accountant. */
const EXPORT_FILE_NAME = "roomly-contratti.csv" as const;

const router: IRouter = Router();

const IdParam = z.coerce.number().int().positive();

type PersonRow = {
  nome_utente?: string | null;
  nome?: string | null;
  cognome?: string | null;
  foto_profilo?: string | null;
  corso_di_studio?: string | null;
  universita?: { nome?: string | null } | null;
} | null;

type RoomRow = { titolo?: string | null; indirizzo?: string | null; citta?: string | null } | null;

type ContractRow = {
  id: number;
  stanza_id: number;
  conversazione_id: number | null;
  data_inizio: string;
  data_fine: string;
  canone_mensile: number | string;
  deposito: number | string | null;
  stato: ContractStatus;
  firma_richiesta_at: string | null;
  firmato_il: string | null;
  registrato_il: string | null;
  estremi_registrazione: string | null;
  concluso_il: string | null;
  created_at: string;
  stanza?: RoomRow;
  studente?: PersonRow;
};

const CONTRACT_SELECT = `
  id,
  stanza_id,
  conversazione_id,
  data_inizio,
  data_fine,
  canone_mensile,
  deposito,
  stato,
  firma_richiesta_at,
  firmato_il,
  registrato_il,
  estremi_registrazione,
  concluso_il,
  created_at,
  stanza:stanza_id(titolo, indirizzo, citta),
  studente:studente_id(nome_utente, nome, cognome, foto_profilo, corso_di_studio, universita:universita_id(nome))
`;

// ===================== HELPERS =====================

/** Today as YYYY-MM-DD in the Italian time zone. */
const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: CONTRACTS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Adds whole days to a YYYY-MM-DD date (calendar maths in UTC, no DST drift). */
const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Length of a contract in months, counting a period that ends the day before the start day as full (1 Nov – 30 Jun = 8). */
const monthsBetween = (start: string, end: string) => {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const whole = (ey - sy) * 12 + (em - sm);
  return Math.max(1, whole + (ed >= sd - 1 ? 1 : 0));
};

const displayName = (person: PersonRow | undefined): string => {
  if (!person) return "Studente";
  const full = `${person.nome ?? ""} ${person.cognome ?? ""}`.trim();
  return full || person.nome_utente || "Studente";
};

const roomAddress = (room: RoomRow | undefined) =>
  [room?.indirizzo, room?.citta].map((part) => part?.trim()).filter(Boolean).join(", ");

/** Registration is due 30 days after signing or the start date, whichever comes first. */
const registrationDeadlineOf = (row: Pick<ContractRow, "stato" | "firmato_il" | "data_inizio">) => {
  if (row.stato !== "firmato" || !row.firmato_il) return null;
  const from = row.firmato_il < row.data_inizio ? row.firmato_il : row.data_inizio;
  return addDays(from, CONTRACT_REGISTRATION_DEADLINE_DAYS);
};

const groupOf = (row: Pick<ContractRow, "stato" | "data_fine">, today: string): ContractGroup => {
  if (row.stato === "bozza" || row.stato === "in_attesa_firma") return "to_sign";
  if (row.stato === "concluso" || row.stato === "annullato") return "ended";
  if (row.data_fine < today) return "ended";
  if (row.data_fine <= addDays(today, CONTRACT_EXPIRING_WINDOW_DAYS)) return "expiring";
  return "active";
};

const toContract = (row: ContractRow, today: string): OwnerContractItem => ({
  id: row.id,
  status: row.stato,
  group: groupOf(row, today),
  roomId: row.stanza_id,
  roomTitle: row.stanza?.titolo ?? "",
  roomAddress: roomAddress(row.stanza),
  studentName: displayName(row.studente),
  studentPhotoUrl: row.studente?.foto_profilo ?? null,
  studentUniversity: row.studente?.universita?.nome ?? null,
  studentCourse: row.studente?.corso_di_studio ?? null,
  conversationId: row.conversazione_id,
  startDate: row.data_inizio,
  endDate: row.data_fine,
  months: monthsBetween(row.data_inizio, row.data_fine),
  monthlyRent: Number(row.canone_mensile),
  deposit: row.deposito == null ? null : Number(row.deposito),
  signatureRequestedAt: row.firma_richiesta_at,
  signedOn: row.firmato_il,
  registeredOn: row.registrato_il,
  registrationReference: row.estremi_registrazione,
  registrationDeadline: registrationDeadlineOf(row),
  endedOn: row.concluso_il,
  createdAt: row.created_at,
});

function serverError(res: Response, label: string, error: unknown) {
  console.error(label, error);
  return res.status(500).json({ error: "Internal server error" });
}

/** Contracts are owner-only: checks `utenti.owner` (mount after requireAuth). */
async function requireOwnerAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = req as AuthenticatedRequest;
  const { data, error } = await supabaseAdmin.from("utenti").select("owner").eq("id", userId).maybeSingle();
  if (error) {
    serverError(res, "Error checking owner account:", error);
    return;
  }
  if (data?.owner !== true) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  next();
}

async function loadOwnerContracts(ownerId: string) {
  const { data, error } = await supabaseAdmin
    .from("contratti")
    .select(CONTRACT_SELECT)
    .eq("proprietario_id", ownerId)
    .order("data_inizio", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ContractRow[];
}

// ===================== ROUTES =====================

/**
 * GET /api/owner/contracts
 * The owner's contracts, the accepted requests that still have no contract
 * ("Nuovo contratto" candidates) and how many rooms are published.
 */
router.get(API_ROUTE_PATHS.OWNER_CONTRACTS, requireAuth, requireOwnerAccount, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const today = todayIso();
  try {
    const [rows, accepted, rooms] = await Promise.all([
      loadOwnerContracts(userId),
      supabaseAdmin
        .from("conversazioni")
        .select(`
          id,
          stanza_id,
          stanza:stanza_id!inner(titolo, indirizzo, citta, prezzo, disponibile_da, disponibile_a, proprietario_id),
          studente:studente_id(nome_utente, nome, cognome)
        `)
        .eq("stato_richiesta", "accettata")
        .eq("stanza.proprietario_id", userId),
      supabaseAdmin
        .from("stanze")
        .select("id", { count: "exact", head: true })
        .eq("proprietario_id", userId)
        .eq("attiva", true),
    ]);
    if (accepted.error) throw accepted.error;
    if (rooms.error) throw rooms.error;

    const withContract = new Set(
      rows.filter((row) => row.stato !== "annullato" && row.conversazione_id != null).map((row) => row.conversazione_id),
    );
    type AcceptedRow = {
      id: number;
      stanza_id: number;
      stanza: (RoomRow & { prezzo?: number | string | null; disponibile_da?: string | null; disponibile_a?: string | null }) | null;
      studente: PersonRow;
    };
    const candidates = ((accepted.data ?? []) as unknown as AcceptedRow[])
      .filter((row) => !withContract.has(row.id))
      .map((row) => ({
        conversationId: row.id,
        roomId: row.stanza_id,
        roomTitle: row.stanza?.titolo ?? "",
        roomAddress: roomAddress(row.stanza),
        studentName: displayName(row.studente),
        suggestedMonthlyRent: Number(row.stanza?.prezzo ?? 0),
        suggestedStartDate: row.stanza?.disponibile_da ?? null,
        suggestedEndDate: row.stanza?.disponibile_a ?? null,
      }));

    return res.json(
      ListOwnerContractsResponse.parse({
        contracts: rows.map((row) => toContract(row, today)),
        candidates,
        publishedRooms: rooms.count ?? 0,
        today,
      }),
    );
  } catch (error) {
    return serverError(res, "Error listing contracts:", error);
  }
});

/**
 * GET /api/owner/contracts/export
 * CSV for the accountant (semicolon separated, UTF-8 with BOM so Excel in
 * Italian opens it correctly). Cancelled contracts are left out.
 */
router.get(API_ROUTE_PATHS.OWNER_CONTRACTS_EXPORT, requireAuth, requireOwnerAccount, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const today = todayIso();
  try {
    const rows = (await loadOwnerContracts(userId)).filter((row) => row.stato !== "annullato");
    const statusLabel: Record<ContractStatus, string> = {
      bozza: "Bozza",
      in_attesa_firma: "In attesa di firma",
      firmato: "Firmato, da registrare",
      registrato: "Registrato",
      concluso: "Concluso",
      annullato: "Annullato",
    };
    const cell = (value: string | number | null | undefined) => {
      const text = value == null ? "" : String(value);
      // Quote every cell; neutralise spreadsheet formulas (=, +, -, @).
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const money = (value: number | null) => (value == null ? "" : value.toFixed(2).replace(".", ","));
    const header = [
      "Stanza",
      "Indirizzo",
      "Studente",
      "Inizio",
      "Fine",
      "Mesi",
      "Canone mensile (EUR)",
      "Deposito (EUR)",
      "Stato",
      "Firmato il",
      "Registrato il",
      "Estremi registrazione",
      "Concluso il",
    ];
    const lines = rows.map((row) => {
      const contract = toContract(row, today);
      return [
        contract.roomTitle,
        contract.roomAddress,
        contract.studentName,
        contract.startDate,
        contract.endDate,
        contract.months,
        money(contract.monthlyRent),
        money(contract.deposit),
        statusLabel[contract.status],
        contract.signedOn,
        contract.registeredOn,
        contract.registrationReference,
        contract.endedOn,
      ]
        .map(cell)
        .join(";");
    });
    const csv = `﻿${[header.map(cell).join(";"), ...lines].join("\r\n")}\r\n`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${EXPORT_FILE_NAME}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(csv);
  } catch (error) {
    return serverError(res, "Error exporting contracts:", error);
  }
});

/**
 * POST /api/owner/contracts
 * Creates a draft contract from one of the owner's accepted requests.
 */
router.post(API_ROUTE_PATHS.OWNER_CONTRACTS, requireAuth, requireOwnerAccount, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const body = CreateOwnerContractBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid contract data" });

  try {
    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversazioni")
      .select("id, stanza_id, studente_id, stato_richiesta, stanza:stanza_id(proprietario_id)")
      .eq("id", body.data.conversationId)
      .maybeSingle();
    if (conversationError) throw conversationError;
    const owned = conversation as unknown as {
      id: number;
      stanza_id: number;
      studente_id: string;
      stato_richiesta: string;
      stanza: { proprietario_id: string } | null;
    } | null;
    if (!owned || owned.stanza?.proprietario_id !== userId) {
      return res.status(404).json({ error: "Request not found" });
    }
    if (owned.stato_richiesta !== "accettata") {
      return res.status(409).json({ error: "Request is not accepted" });
    }

    const { data, error } = await supabaseAdmin
      .from("contratti")
      .insert({
        stanza_id: owned.stanza_id,
        proprietario_id: userId,
        studente_id: owned.studente_id,
        conversazione_id: owned.id,
        data_inizio: body.data.startDate,
        data_fine: body.data.endDate,
        canone_mensile: body.data.monthlyRent,
        deposito: body.data.deposit ?? null,
      })
      .select("id")
      .single();
    if (error) {
      // Unique index: this request already has a live contract.
      if ((error as { code?: string }).code === "23505") {
        return res.status(409).json({ error: "This request already has a contract" });
      }
      throw error;
    }
    return res.status(201).json({ id: data.id });
  } catch (error) {
    return serverError(res, "Error creating contract:", error);
  }
});

/**
 * POST /api/owner/contracts/:id/status
 * Moves a contract to its next step. Each action only applies from the
 * statuses listed in TRANSITIONS; anything else is a 409.
 */
const TRANSITIONS: Record<z.infer<typeof UpdateOwnerContractStatusBody>["action"], { from: ContractStatus[]; to: ContractStatus }> = {
  send_for_signature: { from: ["bozza"], to: "in_attesa_firma" },
  mark_signed: { from: ["bozza", "in_attesa_firma"], to: "firmato" },
  mark_registered: { from: ["firmato"], to: "registrato" },
  mark_ended: { from: ["firmato", "registrato"], to: "concluso" },
  cancel: { from: ["bozza", "in_attesa_firma"], to: "annullato" },
};

router.post(API_ROUTE_PATHS.OWNER_CONTRACT_STATUS, requireAuth, requireOwnerAccount, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = IdParam.safeParse(req.params.id);
  const body = UpdateOwnerContractStatusBody.safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ error: "Invalid request" });

  const { action, date, registrationReference } = body.data;
  const today = todayIso();
  const transition = TRANSITIONS[action];

  const update: Record<string, string | null> = { stato: transition.to, updated_at: new Date().toISOString() };
  if (action === "send_for_signature") update.firma_richiesta_at = new Date().toISOString();
  if (action === "mark_signed" || action === "mark_registered" || action === "mark_ended") {
    if (!date) return res.status(400).json({ error: "Date is required" });
    // Signing, registration and the keys being handed back are recorded once
    // they happened: today or earlier, never in the future.
    if (date > today) return res.status(400).json({ error: "Date cannot be in the future" });
  }
  if (action === "mark_signed") update.firmato_il = date!;
  if (action === "mark_registered") {
    update.registrato_il = date!;
    update.estremi_registrazione = registrationReference?.trim() || null;
  }
  if (action === "mark_ended") update.concluso_il = date!;

  try {
    const { data, error } = await supabaseAdmin
      .from("contratti")
      .update(update)
      .eq("id", id.data)
      .eq("proprietario_id", userId)
      .in("stato", transition.from)
      .select("id, stanza_id");
    if (error) throw error;
    if (!data?.length) return res.status(409).json({ error: "Contract cannot change to this step" });

    // An ended contract frees the room, so it can be rented again and the
    // student can accept another room. RM006 = the room was already freed.
    if (action === "mark_ended") {
      const releaseError = await releaseRoom(data[0].stanza_id, userId);
      if (releaseError && releaseError.code !== "RM006") {
        console.error("Contract ended but the room could not be freed:", releaseError);
      }
    }
    return res.json({ success: true });
  } catch (error) {
    return serverError(res, "Error updating contract:", error);
  }
});

export default router;
