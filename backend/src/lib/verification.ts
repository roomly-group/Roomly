import { supabaseAdmin } from "./supabase-admin.js";
import { logger } from "./logger.js";
import { VERIFICATION_FILE_RETENTION_DAYS } from "@workspace/api-zod";

// Identity verification helpers shared by routes/verification.ts (the flow
// and the review) and routes/roomly.ts (the badge on the listing page).

// ===================== CONFIGURATION =====================

/** Supabase storage bucket for document photos and challenge videos (private, see migrations/011). */
export const VERIFICATION_BUCKET = "verifiche_identita" as const;
/** Table with one row per verification attempt. */
export const VERIFICATION_TABLE = "verifiche_identita" as const;
/** Lifetime of the signed URLs reviewers use to see the files (seconds). */
const VERIFICATION_FILE_URL_TTL_SECONDS = 900 as const;
/** How often the backend deletes files it no longer may keep (ms, 6 hours). */
const PURGE_INTERVAL_MS = 21_600_000 as const;
/** Attempts handled per purge run, so one run never grows unbounded. */
const PURGE_BATCH_SIZE = 200 as const;

const DAY_MS = 86_400_000;

// ===================== BADGE =====================

/** True when the user has an approved verification. A failed lookup counts as "not verified". */
export async function isUserVerified(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabaseAdmin
    .from(VERIFICATION_TABLE)
    .select("id")
    .eq("utente_id", userId)
    .eq("stato", "approvata")
    .limit(1);
  if (error) {
    logger.warn({ err: error.message }, "Could not read identity verification");
    return false;
  }
  return (data ?? []).length > 0;
}

// ===================== LOCKED IDENTITY =====================

/** Account fields a reviewer compares with the document. */
export type IdentityField = "nome" | "cognome" | "data_nascita";

/**
 * Name and date of birth are frozen while a verification is under review or
 * approved: they are what the reviewer checked against the document. After a
 * rejection they can be fixed again. Throws on a failed lookup (fails closed).
 */
export async function isIdentityLocked(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from(VERIFICATION_TABLE)
    .select("id")
    .eq("utente_id", userId)
    .in("stato", ["in_attesa", "approvata"])
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * True when `changes` would give a locked identity field a different value.
 * Sending the same value again (e.g. the profile form saving unchanged names) is allowed.
 */
export async function changesLockedIdentity(
  userId: string,
  changes: Partial<Record<IdentityField, string | null>>,
): Promise<boolean> {
  const fields = (Object.keys(changes) as IdentityField[]).filter((field) => changes[field] !== undefined);
  if (fields.length === 0 || !(await isIdentityLocked(userId))) return false;

  const { data, error } = await supabaseAdmin.from("utenti").select("nome, cognome, data_nascita").eq("id", userId).maybeSingle();
  if (error) throw error;
  const current = (data ?? {}) as Partial<Record<IdentityField, string | null>>;
  const normalise = (value: string | null | undefined) => (value ?? "").trim();
  return fields.some((field) => normalise(changes[field]) !== normalise(current[field]));
}

// ===================== FILES =====================

/** Short-lived URL for a stored verification file, or null. */
export async function signedVerificationFileUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(VERIFICATION_BUCKET)
    .createSignedUrl(path, VERIFICATION_FILE_URL_TTL_SECONDS);
  if (error) {
    logger.warn({ err: error.message }, "Failed to sign verification file URL");
    return null;
  }
  return data.signedUrl;
}

/** Removes the given stored files (empty or null paths are skipped). */
export async function removeVerificationFiles(paths: (string | null | undefined)[]): Promise<void> {
  const existing = paths.filter((path): path is string => Boolean(path));
  if (existing.length === 0) return;
  const { error } = await supabaseAdmin.storage.from(VERIFICATION_BUCKET).remove(existing);
  if (error) throw error;
}

type PurgeRow = {
  id: number;
  documento_fronte: string | null;
  documento_retro: string | null;
  video: string | null;
};

/**
 * Deletes the files Roomly may no longer keep and records when:
 *   - decided attempts without training consent, VERIFICATION_FILE_RETENTION_DAYS after the decision;
 *   - attempts left half-way (bozza), the same number of days after their last change.
 * The outcome (who, when, approved or not) stays in the table.
 */
export async function purgeExpiredVerificationFiles(): Promise<number> {
  const cutoff = new Date(Date.now() - VERIFICATION_FILE_RETENTION_DAYS * DAY_MS).toISOString();
  const columns = "id, documento_fronte, documento_retro, video";

  const [decided, abandoned] = await Promise.all([
    supabaseAdmin
      .from(VERIFICATION_TABLE)
      .select(columns)
      .is("file_eliminati_at", null)
      .in("stato", ["approvata", "rifiutata"])
      .eq("consenso_addestramento", false)
      .lt("decisa_at", cutoff)
      .limit(PURGE_BATCH_SIZE),
    supabaseAdmin
      .from(VERIFICATION_TABLE)
      .select(columns)
      .is("file_eliminati_at", null)
      .eq("stato", "bozza")
      .lt("updated_at", cutoff)
      .limit(PURGE_BATCH_SIZE),
  ]);
  if (decided.error) throw decided.error;
  if (abandoned.error) throw abandoned.error;

  const rows = [...(decided.data ?? []), ...(abandoned.data ?? [])] as PurgeRow[];
  for (const row of rows) {
    await removeVerificationFiles([row.documento_fronte, row.documento_retro, row.video]);
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from(VERIFICATION_TABLE)
      .update({ documento_fronte: null, documento_retro: null, video: null, file_eliminati_at: now, updated_at: now })
      .eq("id", row.id);
    if (error) throw error;
  }
  return rows.length;
}

/** Runs the purge now and then every PURGE_INTERVAL_MS. Errors are logged, never thrown. */
export function scheduleVerificationPurge(): void {
  const run = () => {
    purgeExpiredVerificationFiles()
      .then((count) => {
        if (count > 0) logger.info({ count }, "Deleted expired identity verification files");
      })
      .catch((err: unknown) => {
        logger.warn({ err: err instanceof Error ? err.message : err }, "Identity verification purge failed");
      });
  };
  run();
  setInterval(run, PURGE_INTERVAL_MS).unref();
}
