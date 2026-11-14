import { supabaseAdmin } from "./supabase-admin.js";
import { logger } from "./logger.js";
import { listFiles, listFolders } from "./storage-files.js";
import { VERIFICATION_FILE_RETENTION_DAYS, VERIFICATION_TRAINING_RETENTION_DAYS } from "@workspace/api-zod";

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
/** Attempts (or orphaned user folders) handled per purge run, so one run never grows unbounded. */
const PURGE_BATCH_SIZE = 200 as const;
/** User ids per `.in()` lookup in the orphan sweep: keeps the request URL short (36-char UUIDs). */
const USER_ID_CHUNK_SIZE = 100 as const;
/** Folder depth of the bucket below the user folder: <user id>/<attempt id>/<file>. */
const VERIFICATION_FOLDER_DEPTH = 2 as const;
/** Top-level folders are user ids; anything else in the bucket root is left alone. */
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/**
 * Removes EVERY stored file of one attempt: the paths saved in the row plus
 * anything else left in its folder (<user id>/<attempt id>/), e.g. an old video
 * whose cleanup failed. Call it before deleting the row: the DB refuses to
 * delete a row while its folder still holds files (migrations/021).
 */
export async function removeAttemptFiles(attempt: {
  id: number;
  utente_id: string;
  documento_fronte: string | null;
  documento_retro: string | null;
  video: string | null;
}): Promise<void> {
  const folderFiles = await listFiles(VERIFICATION_BUCKET, `${attempt.utente_id}/${attempt.id}`, 1);
  await removeVerificationFiles([
    ...new Set([...folderFiles, attempt.documento_fronte, attempt.documento_retro, attempt.video]),
  ]);
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
 *   - decided attempts WITH training consent, VERIFICATION_TRAINING_RETENTION_DAYS after the
 *     decision (RMY-03: consent never means keeping biometric data forever). Counted from
 *     decisa_at, which never moves, so switching consent off and on again cannot extend it;
 *   - attempts left half-way (bozza), VERIFICATION_FILE_RETENTION_DAYS after their last change.
 * The outcome (who, when, approved or not) stays in the table.
 */
export async function purgeExpiredVerificationFiles(): Promise<number> {
  const now = Date.now();
  const cutoff = new Date(now - VERIFICATION_FILE_RETENTION_DAYS * DAY_MS).toISOString();
  const trainingCutoff = new Date(now - VERIFICATION_TRAINING_RETENTION_DAYS * DAY_MS).toISOString();
  const columns = "id, documento_fronte, documento_retro, video";

  /** Decided attempts with this training choice whose decision is older than `before`. */
  const decidedBefore = (consentTraining: boolean, before: string) =>
    supabaseAdmin
      .from(VERIFICATION_TABLE)
      .select(columns)
      .is("file_eliminati_at", null)
      .in("stato", ["approvata", "rifiutata"])
      .eq("consenso_addestramento", consentTraining)
      .lt("decisa_at", before)
      .limit(PURGE_BATCH_SIZE);

  const [decided, trainingExpired, abandoned] = await Promise.all([
    decidedBefore(false, cutoff),
    decidedBefore(true, trainingCutoff),
    supabaseAdmin
      .from(VERIFICATION_TABLE)
      .select(columns)
      .is("file_eliminati_at", null)
      .eq("stato", "bozza")
      .lt("updated_at", cutoff)
      .limit(PURGE_BATCH_SIZE),
  ]);
  if (decided.error) throw decided.error;
  if (trainingExpired.error) throw trainingExpired.error;
  if (abandoned.error) throw abandoned.error;

  const rows = [...(decided.data ?? []), ...(trainingExpired.data ?? []), ...(abandoned.data ?? [])] as PurgeRow[];
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

/**
 * RMY-03 safety net: deletes the files of users who no longer exist.
 * The app deletes them before the account (lib/account.ts), but a user row
 * removed some other way (e.g. by hand in the Supabase dashboard) would leave
 * ID documents and face videos behind with nothing pointing at them.
 * Top-level folders are user ids: any id missing from `utenti` is an orphan.
 * A failed lookup throws, so nothing is ever deleted on a guess.
 * Returns the number of user folders emptied.
 */
export async function purgeOrphanedVerificationFiles(): Promise<number> {
  const userFolders = (await listFolders(VERIFICATION_BUCKET, "")).filter((name) => USER_ID_PATTERN.test(name));

  const orphans: string[] = [];
  for (let start = 0; start < userFolders.length && orphans.length < PURGE_BATCH_SIZE; start += USER_ID_CHUNK_SIZE) {
    const chunk = userFolders.slice(start, start + USER_ID_CHUNK_SIZE);
    const { data, error } = await supabaseAdmin.from("utenti").select("id").in("id", chunk);
    if (error) throw error;
    const existing = new Set((data ?? []).map((row) => String(row.id).toLowerCase()));
    orphans.push(...chunk.filter((id) => !existing.has(id.toLowerCase())));
  }

  const batch = orphans.slice(0, PURGE_BATCH_SIZE);
  for (const userId of batch) {
    await removeVerificationFiles(await listFiles(VERIFICATION_BUCKET, userId, VERIFICATION_FOLDER_DEPTH));
  }
  return batch.length;
}

/**
 * Runs both purges now and then every PURGE_INTERVAL_MS. They run one after
 * the other and independently: one failing never stops the other.
 * Errors are logged (counts only, no personal data), never thrown.
 */
export function scheduleVerificationPurge(): void {
  const logFailure = (err: unknown, label: string) =>
    logger.warn({ err: err instanceof Error ? err.message : err }, label);

  const run = async () => {
    try {
      const count = await purgeExpiredVerificationFiles();
      if (count > 0) logger.info({ count }, "Deleted expired identity verification files");
    } catch (err) {
      logFailure(err, "Identity verification purge failed");
    }
    try {
      const count = await purgeOrphanedVerificationFiles();
      if (count > 0) logger.info({ count }, "Deleted identity verification files of deleted users");
    } catch (err) {
      logFailure(err, "Identity verification orphan purge failed");
    }
  };
  void run();
  setInterval(() => void run(), PURGE_INTERVAL_MS).unref();
}
