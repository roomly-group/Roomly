import { Router, type IRouter } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { VERIFICATION_TABLE } from "../lib/verification.js";
import {
  ADMIN_QUEUE_SIZE,
  ADMIN_RECENT_WINDOW_DAYS,
  API_ROUTE_PATHS,
  AdminStatsResponse,
  CONTRACT_REGISTRATION_DEADLINE_DAYS,
  ONBOARDING_OPTIONS,
  VERIFICATION_REJECTION_REASONS,
  type VerificationRejectionReason,
} from "@workspace/api-zod";

// Admin dashboard (/admin in the frontend): counts across the app and the
// work queues the team handles by hand. Only counts and the few rows the
// queues need leave this route; personal details stay on the detail pages.

// ===================== CONFIGURATION =====================

/** Time zone used to decide what "today" is for contract dates. */
const ADMIN_TIME_ZONE = "Europe/Rome" as const;
/** User reports (routes/safety.ts, migrations/019). */
const REPORTS_TABLE = "segnalazioni" as const;

const DAY_MS = 86_400_000;

const router: IRouter = Router();

// ===================== HELPERS =====================

/** Today as YYYY-MM-DD in the Italian time zone. */
const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ADMIN_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Adds whole days to a YYYY-MM-DD date (calendar maths in UTC). */
const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

type Person = { nome_utente?: string | null; nome?: string | null; cognome?: string | null } | null;

const displayName = (person: Person | undefined) =>
  `${person?.nome ?? ""} ${person?.cognome ?? ""}`.trim() || person?.nome_utente || "—";

/** Row count of a head-only query; throws on error. */
async function countOf(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

const head = { count: "exact" as const, head: true };

// ===================== ROUTE =====================

/**
 * GET /api/admin/stats
 * Every number on the dashboard in one response. The counts run in parallel
 * as head-only queries, so no rows are transferred for them.
 */
router.get(API_ROUTE_PATHS.ADMIN_STATS, requireAuth, requireAdmin, async (_req, res) => {
  res.set("Cache-Control", "no-store");
  const today = todayIso();
  const weekAgo = new Date(Date.now() - ADMIN_RECENT_WINDOW_DAYS * DAY_MS).toISOString();

  try {
    const [
      usersTotal,
      owners,
      usersNew,
      onboardingCompleted,
      invited,
      sourceCounts,
      listingsActive,
      listingsAvailable,
      listingsRented,
      listingsNew,
      requestsPending,
      requestsAccepted,
      requestsRejected,
      requestsCancelled,
      contractsToSign,
      verificationsPending,
      verificationsApproved,
      verificationsRejected,
      reportsOpen,
    ] = await Promise.all([
      countOf(supabaseAdmin.from("utenti").select("id", head)),
      countOf(supabaseAdmin.from("utenti").select("id", head).eq("owner", true)),
      countOf(supabaseAdmin.from("utenti").select("id", head).gte("created_at", weekAgo)),
      countOf(supabaseAdmin.from("utenti").select("id", head).not("onboarding_completato_at", "is", null)),
      countOf(supabaseAdmin.from("utenti").select("id", head).not("invitato_da", "is", null)),
      Promise.all(
        ONBOARDING_OPTIONS.sources.map((source) =>
          countOf(supabaseAdmin.from("utenti").select("id", head).contains("fonti_scoperta", [source])),
        ),
      ),
      countOf(supabaseAdmin.from("stanze").select("id", head).eq("attiva", true)),
      countOf(supabaseAdmin.from("stanze").select("id", head).eq("attiva", true).eq("stato", "disponibile")),
      countOf(supabaseAdmin.from("stanze").select("id", head).eq("stato", "affittata")),
      countOf(supabaseAdmin.from("stanze").select("id", head).gte("created_at", weekAgo)),
      countOf(supabaseAdmin.from("conversazioni").select("id", head).eq("stato_richiesta", "in_attesa")),
      countOf(supabaseAdmin.from("conversazioni").select("id", head).eq("stato_richiesta", "accettata")),
      countOf(supabaseAdmin.from("conversazioni").select("id", head).eq("stato_richiesta", "rifiutata")),
      countOf(supabaseAdmin.from("conversazioni").select("id", head).eq("stato_richiesta", "annullata")),
      countOf(supabaseAdmin.from("contratti").select("id", head).in("stato", ["bozza", "in_attesa_firma"])),
      countOf(supabaseAdmin.from(VERIFICATION_TABLE).select("id", head).eq("stato", "in_attesa")),
      countOf(supabaseAdmin.from(VERIFICATION_TABLE).select("id", head).eq("stato", "approvata")),
      countOf(supabaseAdmin.from(VERIFICATION_TABLE).select("id", head).eq("stato", "rifiutata")),
      countOf(supabaseAdmin.from(REPORTS_TABLE).select("id", head).eq("stato", "aperta")),
    ]);

    const [signedContracts, runningContracts, oldestPending, rejections, recentListings, oldestReport] = await Promise.all([
      supabaseAdmin
        .from("contratti")
        .select("id, firmato_il, data_inizio, stanza:stanza_id(titolo), proprietario:proprietario_id(nome_utente, nome, cognome), studente:studente_id(nome_utente, nome, cognome)")
        .eq("stato", "firmato")
        .not("firmato_il", "is", null),
      supabaseAdmin
        .from("contratti")
        .select("canone_mensile")
        .in("stato", ["firmato", "registrato"])
        .gte("data_fine", today),
      supabaseAdmin
        .from(VERIFICATION_TABLE)
        .select("inviata_at")
        .eq("stato", "in_attesa")
        .order("inviata_at", { ascending: true })
        .limit(1),
      supabaseAdmin.from(VERIFICATION_TABLE).select("motivo_rifiuto").eq("stato", "rifiutata"),
      supabaseAdmin
        .from("stanze")
        .select("id, titolo, citta, prezzo, created_at, proprietario:proprietario_id(nome_utente, nome, cognome)")
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(ADMIN_QUEUE_SIZE),
      supabaseAdmin
        .from(REPORTS_TABLE)
        .select("created_at")
        .eq("stato", "aperta")
        .order("created_at", { ascending: true })
        .limit(1),
    ]);
    for (const result of [signedContracts, runningContracts, oldestPending, rejections, recentListings, oldestReport]) {
      if (result.error) throw result.error;
    }

    // Registration is due 30 days after signing or the start date, whichever comes first (as in routes/contracts.ts).
    type SignedRow = {
      id: number;
      firmato_il: string;
      data_inizio: string;
      stanza: { titolo: string | null } | null;
      proprietario: Person;
      studente: Person;
    };
    const signedRows = (signedContracts.data ?? []) as unknown as SignedRow[];
    const contractsToRegister = signedRows
      .map((row) => {
        const from = row.firmato_il < row.data_inizio ? row.firmato_il : row.data_inizio;
        return {
          id: row.id,
          roomTitle: row.stanza?.titolo ?? "",
          ownerName: displayName(row.proprietario),
          studentName: displayName(row.studente),
          signedOn: row.firmato_il,
          registrationDeadline: addDays(from, CONTRACT_REGISTRATION_DEADLINE_DAYS),
        };
      })
      .sort((a, b) => a.registrationDeadline.localeCompare(b.registrationDeadline));

    const runningRows = (runningContracts.data ?? []) as { canone_mensile: number | string }[];

    const reasonCounts = new Map<VerificationRejectionReason, number>();
    for (const row of (rejections.data ?? []) as { motivo_rifiuto: VerificationRejectionReason | null }[]) {
      if (row.motivo_rifiuto) reasonCounts.set(row.motivo_rifiuto, (reasonCounts.get(row.motivo_rifiuto) ?? 0) + 1);
    }

    type ListingRow = { id: number; titolo: string | null; citta: string | null; prezzo: number | string | null; created_at: string; proprietario: Person };

    return res.json(
      AdminStatsResponse.parse({
        generatedAt: new Date().toISOString(),
        users: {
          total: usersTotal,
          students: usersTotal - owners,
          owners,
          newThisWeek: usersNew,
          onboardingCompleted,
          invited,
        },
        discoverySources: ONBOARDING_OPTIONS.sources
          .map((source, index) => ({ source, count: sourceCounts[index] }))
          .sort((a, b) => b.count - a.count),
        listings: {
          active: listingsActive,
          available: listingsAvailable,
          rented: listingsRented,
          newThisWeek: listingsNew,
        },
        requests: {
          pending: requestsPending,
          accepted: requestsAccepted,
          rejected: requestsRejected,
          cancelled: requestsCancelled,
        },
        contracts: {
          active: runningRows.length,
          toSign: contractsToSign,
          toRegister: contractsToRegister.length,
          monthlyRentUnderContract: runningRows.reduce((sum, row) => sum + Number(row.canone_mensile), 0),
        },
        verifications: {
          pending: verificationsPending,
          oldestPendingAt: (oldestPending.data ?? [])[0]?.inviata_at ?? null,
          approved: verificationsApproved,
          rejected: verificationsRejected,
          rejectionReasons: VERIFICATION_REJECTION_REASONS.filter((reason) => reasonCounts.has(reason))
            .map((reason) => ({ reason, count: reasonCounts.get(reason)! }))
            .sort((a, b) => b.count - a.count),
        },
        reports: {
          open: reportsOpen,
          oldestOpenAt: (oldestReport.data ?? [])[0]?.created_at ?? null,
        },
        queues: {
          contractsToRegister: contractsToRegister.slice(0, ADMIN_QUEUE_SIZE),
          recentListings: ((recentListings.data ?? []) as unknown as ListingRow[]).map((row) => ({
            id: row.id,
            title: row.titolo ?? "",
            city: row.citta ?? "",
            ownerName: displayName(row.proprietario),
            price: Number(row.prezzo ?? 0),
            createdAt: row.created_at,
          })),
        },
      }),
    );
  } catch (error) {
    console.error("Error building admin stats:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
