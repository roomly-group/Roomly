import { supabaseAdmin } from "./supabase-admin.js";
import { errorForLog, logger } from "./logger.js";
import { SIGNUP_CONSENT_VERSION } from "@workspace/api-zod";

// ===================== CONFIGURATION =====================

/**
 * user_metadata keys where POST /api/register stores the signup consent
 * (RMY-15) until the `utenti` row exists. The DB trigger
 * handle_email_confirmed (migrations/022) reads the same keys.
 */
export const SIGNUP_CONSENT_METADATA_KEYS = {
  ACCEPTED_AT: "termini_accettati_at",
  VERSION: "termini_versione",
} as const;
/** Longest policy version accepted from metadata (characters; same limit as the DB check). */
const CONSENT_VERSION_MAX_LENGTH = 32 as const;

/** Consent fields to save on a new `utenti` row, from metadata; null when missing or malformed. */
function consentFromMetadata(metadata: Record<string, unknown>) {
  const acceptedAt = metadata[SIGNUP_CONSENT_METADATA_KEYS.ACCEPTED_AT];
  const version = metadata[SIGNUP_CONSENT_METADATA_KEYS.VERSION];
  const acceptedAtMs = typeof acceptedAt === "string" ? Date.parse(acceptedAt) : NaN;
  if (Number.isNaN(acceptedAtMs) || typeof version !== "string" || !version || version.length > CONSENT_VERSION_MAX_LENGTH) {
    return { termini_accettati_at: null, termini_versione: null };
  }
  // Never in the future (metadata can be edited by its owner).
  return {
    termini_accettati_at: new Date(Math.min(acceptedAtMs, Date.now())).toISOString(),
    termini_versione: version,
  };
}

/**
 * Saves that the user accepted the Terms and Privacy Policy (RMY-15), with
 * the current policy version. Only fills an empty value, never overwrites an
 * earlier acceptance. Used after "Continue with Google" from the signup page.
 * Never throws: a failure is logged and the login goes on.
 */
export async function recordSignupConsent(userId: string, acceptedAt: Date) {
  try {
    // The row normally exists already (Google accounts are confirmed at once,
    // so the DB trigger created it); make sure of it before the update.
    await ensureUtenteRecord(userId);
    const { error } = await supabaseAdmin
      .from("utenti")
      .update({ termini_accettati_at: acceptedAt.toISOString(), termini_versione: SIGNUP_CONSENT_VERSION })
      .eq("id", userId)
      .is("termini_accettati_at", null);
    if (error) logger.error({ error: errorForLog(error) }, "Failed to save signup consent");
  } catch (error) {
    logger.error({ error: errorForLog(error) }, "Failed to save signup consent");
  }
}

// Crea il record in "utenti" per un utente che ha fatto login ma non ha
// ancora una riga (lazy creation), es. quando una route viene chiamata
// prima che il trigger `handle_email_confirmed` su auth.users abbia fatto
// in tempo a inserirla.
//
// IMPORTANTE: "posizione" NON è una colonna IDENTITY, è un BIGINT DEFAULT 0
// (vedi migration 202609040001). Se qui non calcoliamo esplicitamente il
// valore, la riga viene creata con posizione = 0, e quando il trigger del
// DB prova a inserirla a sua volta trova già la riga (ON CONFLICT DO
// NOTHING) e non la corregge più: l'utente resta bloccato a una posizione
// finta. Per questo calcoliamo qui la stessa logica del trigger.
export async function ensureUtenteRecord(userId: string) {
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (authError || !authUser) {
    return null;
  }

  const { email_confirmed_at } = authUser.user;
  if (!email_confirmed_at) {
    return null;
  }

  // Date of birth is NOT copied from metadata (RMY-15): anyone can put any
  // value there by signing up against Supabase directly. It is set only by
  // the onboarding (routes/onboarding.ts), which checks the user is 18+.
  const metadata: Record<string, unknown> = authUser.user.user_metadata ?? {};
  const nome = typeof metadata.nome === "string" ? metadata.nome : "";
  const cognome = typeof metadata.cognome === "string" ? metadata.cognome : "";

  const { data: maxRow } = await supabaseAdmin
    .from("utenti")
    .select("posizione")
    .order("posizione", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosizione = (maxRow?.posizione ?? 0) + 1;

  // First, check if a record already exists
  const { error: selectError } = await supabaseAdmin
    .from("utenti")
    .select("id")
    .eq("id", userId)
    .single();

  // If we got an error that is not because the record doesn't exist, return null
  if (selectError && selectError.code !== 'PGRST116') {
    logger.error({ error: errorForLog(selectError) }, "Failed to fetch utenti record");
    return null;
  }

  // If record doesn't exist, insert it
  if (selectError && selectError.code === 'PGRST116') {
    const { error: insertError } = await supabaseAdmin.from("utenti").insert({
      id: userId,
      email: authUser.user.email ?? "",
      nome,
      cognome,
      email_verificata: true,
      posizione: nextPosizione,
      // Signup consent saved by POST /api/register (RMY-15).
      ...consentFromMetadata(metadata),
    });

    if (insertError) {
      logger.error({ error: errorForLog(insertError) }, "Failed to create utenti record");
      return null;
    }
  }

  // Fetch and return the complete record
  const { data: newRow, error: newError } = await supabaseAdmin
    .from("utenti")
    .select("nome, cognome, email, posizione, admin, owner, lingua, data_nascita")
    .eq("id", userId)
    .single();

  if (newError || !newRow) {
    return null;
  }

  return newRow;
}
