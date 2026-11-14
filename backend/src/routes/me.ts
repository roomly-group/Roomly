import { Router, type IRouter } from "express";
import { forgetUser, requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { accountDataLimiter, emailChangeLimiter } from "../middleware/rateLimit.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { createRequestAuthClient } from "../lib/supabase-auth.js";
import { createPkcePair, requestEmailChange } from "../lib/supabase-pkce.js";
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
import { ACCESS_TOKEN_COOKIE_NAME, EMAIL_LINK_VERIFIER_MAX_AGE_SECONDS, clearAuthCookies, setPkceVerifierCookie } from "./auth.js";
import {
  ACCOUNT_DELETE_CONFIRMATION,
  ACCOUNT_DELETE_ERROR_CODES,
  API_ROUTE_PATHS,
  DEFAULT_USER_PREFERENCES,
  EMAIL_CHANGE_ERROR_CODES,
  EMAIL_CHANGE_METHODS,
  type EmailChangeMethod,
  IDENTITY_LOCKED_CODE,
  IDENTITY_LOCKED_MESSAGE,
  SUPPORTED_LANGUAGE_CODES,
  USER_PREFERENCE_OPTIONS,
} from "@workspace/api-zod";
import { z } from "zod";
import { errorForLog, logger } from "../lib/logger.js";

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
    logger.error({ error: errorForLog(lockError) }, "Failed to check identity lock");
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
    logger.error({ error: errorForLog(error) }, "Failed to update user profile");
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
    logger.error({ error: errorForLog(error) }, "Failed to update language");
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
    logger.error({ error: errorForLog(error) }, "Failed to fetch user preferences");
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
    logger.error({ error: errorForLog(error) }, "Failed to save user preferences");
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
    logger.error({ error: errorForLog(error) }, "Failed to export account data");
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
    logger.error({ error: errorForLog(error) }, "Failed to delete account");
    res.status(500).json({ error: "Impossibile eliminare l'account, riprova" });
  }
});

// ===================== EMAIL CHANGE =====================
// Changing the login email needs proof that the person at the keyboard owns
// the account, not just a live session (a stolen or forgotten-open session
// could otherwise move the account to another address):
// - accounts with a password type it again;
// - accounts without one (signed up with Google) get a one-time code at their
//   current address (POST /api/me/email/code) and type that.
// The change itself goes through PKCE, so the confirmation link comes back
// with `?code=` and never puts tokens in the URL (see lib/supabase-pkce.ts).

/** Longest password accepted for the check (characters); only bounds the request size. */
const EMAIL_CHANGE_PASSWORD_MAX_LENGTH = 1024 as const;
/** Longest Turnstile token accepted (characters); only bounds the request size. */
const CAPTCHA_TOKEN_MAX_LENGTH = 4096 as const;
/** Longest email address (characters, RFC 5321). */
const EMAIL_MAX_LENGTH = 254 as const;
/** The emailed one-time code: digits only, 6-10 long (Supabase's OTP length setting). */
const EMAIL_OTP_PATTERN = /^\d{6,10}$/;
/** Identity provider name of email + password accounts in Supabase. */
const PASSWORD_PROVIDER = "email" as const;
/** Supabase error codes meaning the CAPTCHA token was refused. */
const SUPABASE_CAPTCHA_CODES: readonly string[] = ["captcha_failed"];
/** Supabase error codes meaning the new address belongs to another account. */
const SUPABASE_EMAIL_TAKEN_CODES: readonly string[] = ["email_exists", "user_already_exists"];
/** Supabase error codes meaning the new address is not acceptable. */
const SUPABASE_EMAIL_INVALID_CODES: readonly string[] = ["email_address_invalid", "email_address_not_authorized", "validation_failed"];
/** Supabase error codes meaning too many emails or requests for now. */
const SUPABASE_RATE_LIMIT_CODES: readonly string[] = ["over_email_send_rate_limit", "over_request_rate_limit"];

const emailChangeSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(EMAIL_MAX_LENGTH)),
  password: z.string().min(1).max(EMAIL_CHANGE_PASSWORD_MAX_LENGTH).optional(),
  captchaToken: z.string().min(1).max(CAPTCHA_TOKEN_MAX_LENGTH).optional(),
  code: z.string().trim().regex(EMAIL_OTP_PATTERN).optional(),
});

const emailCodeSchema = z.object({
  captchaToken: z.string().min(1).max(CAPTCHA_TOKEN_MAX_LENGTH),
});

/** Password for accounts that have one, emailed code for the others (Google-only). Null if Supabase can't be read. */
async function emailChangeMethod(userId: string): Promise<EmailChangeMethod | null> {
  // getUserById can also throw (e.g. network failure): treat it like an error answer.
  const { data, error } = await supabaseAdmin.auth.admin
    .getUserById(userId)
    .catch((thrown: unknown) => ({ data: { user: null }, error: thrown }));
  if (error || !data.user) {
    logger.error({ error: errorForLog(error) }, "Failed to read auth user for email change");
    return null;
  }
  const providers = [
    ...(data.user.identities ?? []).map((identity) => identity.provider),
    ...((data.user.app_metadata?.["providers"] as string[] | undefined) ?? []),
  ];
  return providers.includes(PASSWORD_PROVIDER) ? EMAIL_CHANGE_METHODS.PASSWORD : EMAIL_CHANGE_METHODS.CODE;
}

/** The password/code check creates a second Supabase session: end it straight away. */
async function endProofSession(accessToken: string | undefined): Promise<void> {
  if (!accessToken) return;
  const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, "local");
  if (error) logger.error({ error: errorForLog(error) }, "Failed to end the email-change check session");
}

const emailChangeError = (code: (typeof EMAIL_CHANGE_ERROR_CODES)[keyof typeof EMAIL_CHANGE_ERROR_CODES], error: string) => ({
  error,
  code,
});

// GET /api/me/email -> { method }: which proof the profile form must ask for.
router.get(API_ROUTE_PATHS.ME_EMAIL, requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const method = await emailChangeMethod(userId);
  if (!method) {
    res.status(500).json({ error: "Internal server error" });
    return;
  }
  res.json({ method });
});

// POST /api/me/email/code  body: { captchaToken }
// Emails a one-time code to the CURRENT address of an account without a
// password. Supabase checks the Turnstile token (CAPTCHA protection).
router.post(API_ROUTE_PATHS.ME_EMAIL_CODE, requireAuth, emailChangeLimiter, async (req, res) => {
  const { userId, userEmail } = req as AuthenticatedRequest;
  const parsed = emailCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.CAPTCHA_FAILED, "Verifica di sicurezza mancante o scaduta"));
    return;
  }

  const method = await emailChangeMethod(userId);
  if (!method) {
    res.status(500).json({ error: "Internal server error" });
    return;
  }
  if (method !== EMAIL_CHANGE_METHODS.CODE || !userEmail) {
    res.status(400).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.WRONG_METHOD, "Usa la password per cambiare email"));
    return;
  }

  // shouldCreateUser: false so this can never create an account.
  const { error } = await createRequestAuthClient().auth.signInWithOtp({
    email: userEmail,
    options: { shouldCreateUser: false, captchaToken: parsed.data.captchaToken },
  });
  if (error) {
    if (SUPABASE_CAPTCHA_CODES.includes(error.code ?? "")) {
      res.status(400).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.CAPTCHA_FAILED, "Verifica di sicurezza mancante o scaduta"));
      return;
    }
    if (SUPABASE_RATE_LIMIT_CODES.includes(error.code ?? "") || error.status === 429) {
      res.status(429).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.TOO_MANY_REQUESTS, "Troppi tentativi, riprova più tardi"));
      return;
    }
    logger.error({ error: errorForLog(error) }, "Failed to send email-change code");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
  res.json({ ok: true });
});

// PATCH /api/me/email  body: { email, password + captchaToken } or { email, code }
// -> { email, pending }: pending=true when Supabase sent confirmation email(s)
// first (the address changes once they are confirmed).
router.patch(API_ROUTE_PATHS.ME_EMAIL, requireAuth, emailChangeLimiter, async (req, res) => {
  const { userId, userEmail } = req as AuthenticatedRequest;
  const accessToken = req.cookies?.[ACCESS_TOKEN_COOKIE_NAME] as string | undefined;
  if (!userEmail || !accessToken) {
    res.status(401).json({ error: "Missing auth cookie" });
    return;
  }

  const parsed = emailChangeSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.email === userEmail.toLowerCase()) {
    res.status(400).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.INVALID_EMAIL, "Email non valida"));
    return;
  }
  const { email, password, captchaToken, code } = parsed.data;

  const method = await emailChangeMethod(userId);
  if (!method) {
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  try {
    // 1. Proof of ownership. Done on a throwaway client (never the shared
    //    one): both calls create a session on the client that runs them.
    const authClient = createRequestAuthClient();
    let proofUserId: string | undefined;
    if (method === EMAIL_CHANGE_METHODS.PASSWORD) {
      if (!password) {
        res.status(400).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.WRONG_METHOD, "Password mancante"));
        return;
      }
      if (!captchaToken) {
        res.status(400).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.CAPTCHA_FAILED, "Verifica di sicurezza mancante o scaduta"));
        return;
      }
      const { data, error } = await authClient.auth.signInWithPassword({ email: userEmail, password, options: { captchaToken } });
      await endProofSession(data.session?.access_token);
      if (error) {
        // Wrong password and CAPTCHA failures are 400 (not 401) so they never look like an expired session.
        const isCaptcha = SUPABASE_CAPTCHA_CODES.includes(error.code ?? "");
        res.status(400).json(
          isCaptcha
            ? emailChangeError(EMAIL_CHANGE_ERROR_CODES.CAPTCHA_FAILED, "Verifica di sicurezza mancante o scaduta")
            : emailChangeError(EMAIL_CHANGE_ERROR_CODES.WRONG_PASSWORD, "Password errata"),
        );
        return;
      }
      proofUserId = data.user?.id;
    } else {
      if (!code) {
        res.status(400).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.WRONG_METHOD, "Codice mancante"));
        return;
      }
      const { data, error } = await authClient.auth.verifyOtp({ email: userEmail, token: code, type: "email" });
      await endProofSession(data.session?.access_token);
      if (error) {
        res.status(400).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.WRONG_CODE, "Codice errato o scaduto"));
        return;
      }
      proofUserId = data.user?.id;
    }
    if (proofUserId !== userId) {
      res.status(403).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.WRONG_METHOD, "Not authorized"));
      return;
    }

    // 2. The change itself, on the caller's own session, with PKCE.
    const { verifier, challenge } = createPkcePair();
    const { data: updated, error } = await requestEmailChange(accessToken, email, challenge);
    if (error) {
      if (SUPABASE_EMAIL_TAKEN_CODES.includes(error.code ?? "")) {
        res.status(409).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.EMAIL_IN_USE, "Email già in uso"));
        return;
      }
      if (SUPABASE_EMAIL_INVALID_CODES.includes(error.code ?? "")) {
        res.status(400).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.INVALID_EMAIL, "Email non valida"));
        return;
      }
      if (SUPABASE_RATE_LIMIT_CODES.includes(error.code ?? "") || error.status === 429) {
        res.status(429).json(emailChangeError(EMAIL_CHANGE_ERROR_CODES.TOO_MANY_REQUESTS, "Troppi tentativi, riprova più tardi"));
        return;
      }
      logger.error({ error: errorForLog(error) }, "Email change refused by Supabase");
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    // Email confirmation off in Supabase: the address is already changed.
    if (updated.email?.toLowerCase() === email) {
      res.json({ email, pending: false });
      return;
    }
    // Confirmation needed: the link logs the user in again when opened in this browser.
    setPkceVerifierCookie(res, verifier, EMAIL_LINK_VERIFIER_MAX_AGE_SECONDS);
    res.json({ email: userEmail, pending: true });
  } catch (error) {
    logger.error({ error: errorForLog(error) }, "Failed to change email");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;