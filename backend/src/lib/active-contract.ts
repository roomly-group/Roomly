import { supabaseAdmin } from "./supabase-admin.js";

// A student can send requests and have them accepted freely; the only limit
// is a running rental contract. While one is active (signed or registered and
// not yet over) they cannot request or take another room.

// ===================== CONFIGURATION =====================

/** Time zone used to decide what "today" is for contract end dates. */
const CONTRACT_TIME_ZONE = "Europe/Rome" as const;
/** Contract steps that count as a running rental. */
const ACTIVE_CONTRACT_STATUSES = ["firmato", "registrato"] as const;

/** Message the frontend matches on (pages/listing-detail.tsx). */
export const ACTIVE_CONTRACT_ERROR = "Student already has an active contract" as const;

/** Today as YYYY-MM-DD in the Italian time zone. */
const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: CONTRACT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/**
 * True when the student has a signed or registered contract that has not ended yet.
 * `exceptContractId` leaves one contract out (the one being signed right now).
 */
export async function studentHasActiveContract(studentId: string, exceptContractId?: number): Promise<boolean> {
  let query = supabaseAdmin
    .from("contratti")
    .select("id")
    .eq("studente_id", studentId)
    .in("stato", [...ACTIVE_CONTRACT_STATUSES])
    .gte("data_fine", todayIso())
    .limit(1);
  if (exceptContractId !== undefined) query = query.neq("id", exceptContractId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).length > 0;
}
