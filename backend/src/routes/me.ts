import { Router, type IRouter } from "express";
import { forgetUser, requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { accountDataLimiter } from "../middleware/rateLimit.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { ensureUtenteRecord } from "../lib/utenti.js";
import { signedProfilePhotoUrl } from "../lib/profile-photo.js";
import { waitlistPosition } from "../lib/waitlist.js";
import { changesLockedIdentity } from "../lib/verification.js";
import {
  ACCOUNT_DELETE_REAUTH_MAX_AGE_SECONDS,
  buildAccountExport,
  deleteAccount,
  hasOpenContracts,
  secondsSinceLastSignIn,
} from "../lib/account.js";
import { ACCESS_TOKEN_COOKIE_NAME, clearAuthCookies } from "./auth.js";
import {
  ACCOUNT_DELETE_CONFIRMATION,
  ACCOUNT_DELETE_ERROR_CODES,
  API_ROUTE_PATHS,
  DEFAULT_USER_PREFERENCES,
  IDENTITY_LOCKED_CODE,
  IDENTITY_LOCKED_MESSAGE,
  SUPPORTED_LANGUAGE_CODES,
  USER_PREFERENCE_OPTIONS,
} from "@workspace/api-zod";
import { z } from "zod";

const router: IRouter = Router();

// Authoritative admin check. Reads the `admin` column on `utenti` using the
// service-role client, which bypasses RLS — this is the one place in the
// system that is allowed to see that value on the caller's behalf. The
// frontend must trust only this response, never read `utenti` directly.
router.get(API_ROUTE_PATHS.ME_ROLE, requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId } = req;

  const { data, error } = await supabaseAdmin
    .from("utenti")
    .select("admin, owner")
    .eq("id", userId)
    .single();

  const row = error || !data ? await ensureUtenteRecord(userId) : data;

  // `owner` è un flag di fiducia: lo assegnano solo operazioni server/admin
  // (vedi migrations/003_protect_owner_flag.sql), non lo si deduce dalle stanze.
  const isOwner = row?.owner === true;

  res.json({
    role: row?.admin ? "admin" : "user",
    owner: isOwner,
  });
});

// Restituisce i dati reali del profilo dell'utente autenticato,
// creando il record in "utenti" se non esiste ancora.
router.get(API_ROUTE_PATHS.ME, requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId } = req;
  const columns = "nome, cognome, email, posizione, lingua, data_nascita, foto_profilo, onboarding_completato_at";

  let { data } = await supabaseAdmin.from("utenti").select(columns).eq("id", userId).maybeSingle();

  if (!data) {
    if (!(await ensureUtenteRecord(userId))) {
      res.status(404).json({ error: "Profilo non trovato" });
      return;
    }
    ({ data } = await supabaseAdmin.from("utenti").select(columns).eq("id", userId).maybeSingle());
    if (!data) {
      res.status(404).json({ error: "Profilo non trovato" });
      return;
    }
  }

  const { foto_profilo, onboarding_completato_at, posizione, ...profile } = data;
  const [fotoProfiloUrl, position] = await Promise.all([
    signedProfilePhotoUrl(foto_profilo),
    waitlistPosition(userId, posizione),
  ]);

  res.json({
    ...profile,
    posizione: position,
    foto_profilo_url: fotoProfiloUrl,
    onboarding_completato: onboarding_completato_at !== null,
    full_name: `${profile.nome ?? ""} ${profile.cognome ?? ""}`.trim(),
  });
});

const profileUpdateSchema = z.object({
  nome: z.string().trim().min(1).max(50),
  cognome: z.string().trim().min(1).max(50),
});

router.patch(API_ROUTE_PATHS.ME_PROFILE, requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsedProfile = profileUpdateSchema.safeParse(req.body);

  if (!parsedProfile.success) {
    res.status(400).json({ error: "Nome e cognome devono contenere da 1 a 50 caratteri" });
    return;
  }

  // After the identity check, name and surname are the ones on the document.
  try {
    if (await changesLockedIdentity(req.userId, parsedProfile.data)) {
      res.status(409).json({ error: IDENTITY_LOCKED_MESSAGE, code: IDENTITY_LOCKED_CODE });
      return;
    }
  } catch (lockError) {
    console.error("Failed to check identity lock:", lockError);
    res.status(500).json({ error: "Impossibile salvare il profilo" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("utenti")
    .update({
      ...parsedProfile.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.userId)
    .select("nome, cognome, email, lingua")
    .single();

  if (error || !data) {
    console.error("Failed to update user profile:", error);
    res.status(500).json({ error: "Impossibile salvare il profilo" });
    return;
  }

  res.json({
    ...data,
    full_name: `${data.nome} ${data.cognome}`.trim(),
  });
});

// Salva la lingua scelta manualmente dall'utente.
router.patch(API_ROUTE_PATHS.ME_LANGUAGE, requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId } = req;
  const { language } = req.body as { language?: string };

  if (!language || !SUPPORTED_LANGUAGE_CODES.includes(language as (typeof SUPPORTED_LANGUAGE_CODES)[number])) {
    res.status(400).json({ error: "Lingua non valida" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("utenti")
    .update({ lingua: language })
    .eq("id", userId);

  if (error) {
    console.error("Failed to update language:", error);
    res.status(500).json({ error: "Impossibile salvare la lingua" });
    return;
  }

  res.json({ language });
});

const userPreferencesSchema = z.object({
  budget_max: z.number().min(0).max(99_999_999.99).multipleOf(0.01).nullable(),
  animali: z.boolean().nullable(),
  fumatori: z.boolean().nullable(),
  livello_rumore_preferito: z.enum(USER_PREFERENCE_OPTIONS.noise),
  ordine_pulizia: z.enum(USER_PREFERENCE_OPTIONS.cleanliness),
  orari_sosta: z.enum(USER_PREFERENCE_OPTIONS.schedule),
  abitudini_studio: z.enum(USER_PREFERENCE_OPTIONS.studyHabits),
});

router.get(API_ROUTE_PATHS.ME_PREFERENCES, requireAuth, async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from("preferenze_utenti")
    .select("budget_max, animali, fumatori, livello_rumore_preferito, ordine_pulizia, orari_sosta, abitudini_studio")
    .eq("utente_id", req.userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch user preferences:", error);
    res.status(500).json({ error: "Impossibile caricare le preferenze" });
    return;
  }

  res.json(data ?? DEFAULT_USER_PREFERENCES);
});

router.put(API_ROUTE_PATHS.ME_PREFERENCES, requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsedPreferences = userPreferencesSchema.safeParse(req.body);

  if (!parsedPreferences.success) {
    res.status(400).json({ error: "Preferenze non valide" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("preferenze_utenti")
    .upsert(
      {
        utente_id: req.userId,
        ...parsedPreferences.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "utente_id" },
    )
    .select("budget_max, animali, fumatori, livello_rumore_preferito, ordine_pulizia, orari_sosta, abitudini_studio")
    .single();

  if (error || !data) {
    console.error("Failed to save user preferences:", error);
    res.status(500).json({ error: "Impossibile salvare le preferenze" });
    return;
  }

  res.json(data);
});

// ===================== PERSONAL DATA (GDPR) =====================

/** Name of the downloaded export file; the date (YYYY-MM-DD) is appended. */
const EXPORT_FILE_NAME_PREFIX = "roomly-my-data-" as const;
/** Spaces used to indent the export JSON, so people can read it. */
const EXPORT_JSON_INDENT = 2 as const;

/**
 * GET /api/me/export
 * Downloads everything Roomly stores about the caller as one JSON file
 * (right of access and portability, GDPR Art. 15 and 20).
 */
router.get(API_ROUTE_PATHS.ME_EXPORT, requireAuth, accountDataLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const data = await buildAccountExport(userId);
    res.set("Cache-Control", "no-store");
    res.attachment(`${EXPORT_FILE_NAME_PREFIX}${new Date().toISOString().slice(0, 10)}.json`);
    res.type("application/json");
    res.send(JSON.stringify(data, null, EXPORT_JSON_INDENT));
  } catch (error) {
    console.error("Failed to export account data:", error);
    res.status(500).json({ error: "Impossibile preparare i tuoi dati" });
  }
});

/**
 * DELETE /api/me   body: { confirm: ACCOUNT_DELETE_CONFIRMATION }
 * Deletes the caller's account and data (right to erasure, GDPR Art. 17).
 * Allowed only within ACCOUNT_DELETE_REAUTH_MAX_AGE_SECONDS of a real login,
 * so a stolen or forgotten session cannot delete an account. Refused (409)
 * while the user has a contract that is not cancelled.
 */
router.delete(API_ROUTE_PATHS.ME, requireAuth, accountDataLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  if ((req.body as { confirm?: unknown } | undefined)?.confirm !== ACCOUNT_DELETE_CONFIRMATION) {
    res.status(400).json({ error: "Conferma mancante", code: ACCOUNT_DELETE_ERROR_CODES.CONFIRMATION_REQUIRED });
    return;
  }

  const token = req.cookies?.[ACCESS_TOKEN_COOKIE_NAME] as string | undefined;
  const sinceLogin = token ? secondsSinceLastSignIn(token) : null;
  if (sinceLogin === null || sinceLogin > ACCOUNT_DELETE_REAUTH_MAX_AGE_SECONDS) {
    res.status(403).json({ error: "Accedi di nuovo per eliminare l'account", code: ACCOUNT_DELETE_ERROR_CODES.REAUTH_REQUIRED });
    return;
  }

  try {
    // Checked before touching any file, so a refused deletion changes nothing.
    // public.elimina_account checks again inside its transaction.
    if (await hasOpenContracts(userId)) {
      res.status(409).json({ error: "Hai un contratto attivo", code: ACCOUNT_DELETE_ERROR_CODES.HAS_CONTRACTS });
      return;
    }

    if ((await deleteAccount(userId)) === "has_contracts") {
      res.status(409).json({ error: "Hai un contratto attivo", code: ACCOUNT_DELETE_ERROR_CODES.HAS_CONTRACTS });
      return;
    }

    forgetUser(userId);
    clearAuthCookies(res);
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete account:", error);
    res.status(500).json({ error: "Impossibile eliminare l'account, riprova" });
  }
});

export default router;