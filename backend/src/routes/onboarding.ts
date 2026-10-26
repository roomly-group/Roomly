import { raw, Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { ensureUtenteRecord } from "../lib/utenti.js";
import { isValidImage, uploadImageType } from "../lib/image.js";
import { PROFILE_PHOTO_BUCKET, signedProfilePhotoUrl } from "../lib/profile-photo.js";
import { countedInvites, waitlistPosition } from "../lib/waitlist.js";
import {
  API_ROUTE_PATHS,
  MINIMUM_SIGNUP_AGE_YEARS,
  WAITLIST_INVITE_BONUS,
  ONBOARDING_OPTIONS,
  PROFILE_BIO_MAX_LENGTH_CHARS,
  PROFILE_PHOTO_MAX_SIZE_BYTES,
  USER_PREFERENCE_OPTIONS,
} from "@workspace/api-zod";

// The onboarding that follows signup (/onboarding in the frontend): the user
// answers one question per screen and each answer is saved as they go, so
// closing the tab never loses progress. Required steps: name, how they found
// Roomly, date of birth, photo (skippable). Then optional ones: university,
// arrival, budget, lifestyle, a short introduction.

// ===================== CONFIGURATION =====================

/** Cache lifetime of uploaded profile photos (seconds, string required by storage API). */
const PROFILE_PHOTO_CACHE_CONTROL_MAX_AGE_SECONDS = "31536000" as const;
/** Oldest accepted date of birth, as an age (years): catches typos like 1092. */
const MAXIMUM_PLAUSIBLE_AGE_YEARS = 100 as const;

const UTENTE_COLUMNS =
  "nome, cognome, data_nascita, foto_profilo, bio, corso_di_studio, posizione, fonte_scoperta, " +
  "fonte_scoperta_altro, arrivo_previsto, durata_permanenza, onboarding_completato_at, universita(nome)";
const PREFERENCE_COLUMNS =
  "budget_max, animali, fumatori, livello_rumore_preferito, ordine_pulizia, orari_sosta, abitudini_studio";

type UtenteRow = {
  nome: string | null;
  cognome: string | null;
  data_nascita: string | null;
  foto_profilo: string | null;
  bio: string | null;
  corso_di_studio: string | null;
  posizione: number | null;
  fonte_scoperta: string | null;
  fonte_scoperta_altro: string | null;
  arrivo_previsto: string | null;
  durata_permanenza: string | null;
  onboarding_completato_at: string | null;
  universita: { nome: string | null } | null;
};

const router: IRouter = Router();

/** "yyyy-mm-dd" that is a real calendar date and belongs to an adult. */
function isAdultBirthDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;

  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const beforeBirthday =
    today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= MINIMUM_SIGNUP_AGE_YEARS && age <= MAXIMUM_PLAUSIBLE_AGE_YEARS;
}

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().transform((value) => (value ? value : null));

const preferencesPatchSchema = z
  .object({
    budget_max: z.number().int().min(0).max(99_999).nullable(),
    animali: z.boolean().nullable(),
    fumatori: z.boolean().nullable(),
    livello_rumore_preferito: z.enum(USER_PREFERENCE_OPTIONS.noise),
    ordine_pulizia: z.enum(USER_PREFERENCE_OPTIONS.cleanliness),
    orari_sosta: z.enum(USER_PREFERENCE_OPTIONS.schedule),
    abitudini_studio: z.enum(USER_PREFERENCE_OPTIONS.studyHabits),
  })
  .partial()
  .strict();

// Every field is optional: each screen sends only its own answers.
const onboardingPatchSchema = z
  .object({
    nome: z.string().trim().min(1).max(50),
    cognome: z.string().trim().min(1).max(50),
    data_nascita: z.string().refine(isAdultBirthDate),
    fonte_scoperta: z.enum(ONBOARDING_OPTIONS.sources),
    fonte_scoperta_altro: optionalText(100),
    universita: optionalText(200),
    corso_di_studio: optionalText(100),
    arrivo_previsto: z.string().regex(/^\d{4}-\d{2}-01$/).nullable(),
    durata_permanenza: z.enum(ONBOARDING_OPTIONS.stayDurations).nullable(),
    bio: optionalText(PROFILE_BIO_MAX_LENGTH_CHARS),
    preferenze: preferencesPatchSchema,
    /** The required steps are done: stamps onboarding_completato_at. */
    completato: z.literal(true),
  })
  .partial()
  .strict();

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Name and surname from the Google profile, to prefill the first screen. */
async function suggestedNames(userId: string): Promise<{ nome: string; cognome: string }> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const metadata = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;

  const given = text(metadata.given_name) ?? text(metadata.nome);
  const family = text(metadata.family_name) ?? text(metadata.cognome);
  if (given || family) return { nome: given ?? "", cognome: family ?? "" };

  const full = text(metadata.full_name) ?? text(metadata.name);
  if (!full) return { nome: "", cognome: "" };
  const [first, ...rest] = full.split(/\s+/);
  return { nome: first, cognome: rest.join(" ") };
}

async function loadUtente(userId: string): Promise<UtenteRow | null> {
  const { data, error } = await supabaseAdmin.from("utenti").select(UTENTE_COLUMNS).eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as UtenteRow | null;
}

/** Everything the onboarding screens need, in one response. */
async function readOnboarding(userId: string) {
  let row = await loadUtente(userId);
  if (!row) {
    await ensureUtenteRecord(userId);
    row = await loadUtente(userId);
  }
  if (!row) return null;

  const needsNames = !row.nome || !row.cognome;
  const [preferencesResult, photoUrl, suggested, posizione] = await Promise.all([
    supabaseAdmin.from("preferenze_utenti").select(PREFERENCE_COLUMNS).eq("utente_id", userId).maybeSingle(),
    signedProfilePhotoUrl(row.foto_profilo),
    needsNames ? suggestedNames(userId) : Promise.resolve(null),
    waitlistPosition(userId, row.posizione),
  ]);
  if (preferencesResult.error) throw preferencesResult.error;

  return {
    posizione,
    nome: row.nome ?? "",
    cognome: row.cognome ?? "",
    nome_suggerito: suggested?.nome ?? "",
    cognome_suggerito: suggested?.cognome ?? "",
    data_nascita: row.data_nascita,
    fonte_scoperta: row.fonte_scoperta,
    fonte_scoperta_altro: row.fonte_scoperta_altro,
    foto_profilo_url: photoUrl,
    universita: row.universita?.nome ?? null,
    corso_di_studio: row.corso_di_studio,
    arrivo_previsto: row.arrivo_previsto,
    durata_permanenza: row.durata_permanenza,
    bio: row.bio,
    preferenze: preferencesResult.data ?? null,
    onboarding_completato_at: row.onboarding_completato_at,
  };
}

router.get(API_ROUTE_PATHS.ME_ONBOARDING, requireAuth, async (req: AuthenticatedRequest, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const onboarding = await readOnboarding(req.userId);
    if (!onboarding) {
      res.status(404).json({ error: "Profilo non trovato" });
      return;
    }
    res.json(onboarding);
  } catch (error) {
    console.error("Failed to load onboarding:", error);
    res.status(500).json({ error: "Impossibile caricare il profilo" });
  }
});

router.patch(API_ROUTE_PATHS.ME_ONBOARDING, requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = onboardingPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    res.status(400).json({
      error: field === "data_nascita"
        ? `Per iscriverti devi avere almeno ${MINIMUM_SIGNUP_AGE_YEARS} anni`
        : "Alcune risposte non sono valide, controlla e riprova",
    });
    return;
  }

  const { userId } = req;
  const { universita, preferenze, completato, ...fields } = parsed.data;
  const update: Record<string, unknown> = { ...fields };

  try {
    if (universita !== undefined) {
      if (universita === null) {
        update.universita_id = null;
      } else {
        const { data: match, error } = await supabaseAdmin
          .from("universita")
          .select("id")
          .eq("nome", universita)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (!match) {
          res.status(400).json({ error: "Scegli un'università dall'elenco" });
          return;
        }
        update.universita_id = match.id;
      }
    }

    // A source other than "altro" never keeps the free text of a previous answer.
    if (fields.fonte_scoperta && fields.fonte_scoperta !== "altro") update.fonte_scoperta_altro = null;

    if (Object.keys(update).length > 0) {
      const { error } = await supabaseAdmin
        .from("utenti")
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
    }

    if (preferenze && Object.keys(preferenze).length > 0) {
      // Only the columns sent are written; a new row takes the table defaults for the rest.
      const { error } = await supabaseAdmin
        .from("preferenze_utenti")
        .upsert(
          { utente_id: userId, ...preferenze, updated_at: new Date().toISOString() },
          { onConflict: "utente_id" },
        );
      if (error) throw error;
    }

    if (completato) {
      const row = await loadUtente(userId);
      if (!row?.nome || !row.cognome || !row.data_nascita || !row.fonte_scoperta) {
        res.status(400).json({ error: "Completa prima i passaggi obbligatori" });
        return;
      }
      if (!row.onboarding_completato_at) {
        const { error } = await supabaseAdmin
          .from("utenti")
          .update({ onboarding_completato_at: new Date().toISOString() })
          .eq("id", userId)
          .is("onboarding_completato_at", null);
        if (error) throw error;
      }
    }

    const onboarding = await readOnboarding(userId);
    res.json(onboarding);
  } catch (error) {
    console.error("Failed to save onboarding:", error);
    res.status(500).json({ error: "Impossibile salvare, riprova tra poco" });
  }
});

router.post(
  API_ROUTE_PATHS.ME_PHOTO,
  requireAuth,
  raw({ type: () => true, limit: PROFILE_PHOTO_MAX_SIZE_BYTES }),
  async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const contentType = uploadImageType(req.header("content-type"));
    if (!contentType) {
      res.status(400).json({ error: "Carica una foto in formato JPG o PNG" });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0 || !isValidImage(req.body, contentType)) {
      res.status(400).json({ error: "Non riusciamo a leggere questa foto, provane un'altra" });
      return;
    }

    const path = `${userId}/${randomUUID()}.${contentType === "image/png" ? "png" : "jpg"}`;
    try {
      const { data: previous, error: previousError } = await supabaseAdmin
        .from("utenti")
        .select("foto_profilo")
        .eq("id", userId)
        .maybeSingle();
      if (previousError) throw previousError;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(PROFILE_PHOTO_BUCKET)
        .upload(path, req.body, {
          contentType,
          cacheControl: PROFILE_PHOTO_CACHE_CONTROL_MAX_AGE_SECONDS,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabaseAdmin
        .from("utenti")
        .update({ foto_profilo: path, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (updateError) {
        await supabaseAdmin.storage.from(PROFILE_PHOTO_BUCKET).remove([path]);
        throw updateError;
      }

      // The old photo is no longer referenced anywhere: remove it (only our own files).
      const previousPath = previous?.foto_profilo;
      if (previousPath && previousPath.startsWith(`${userId}/`)) {
        await supabaseAdmin.storage.from(PROFILE_PHOTO_BUCKET).remove([previousPath]);
      }

      res.status(201).json({ foto_profilo_url: await signedProfilePhotoUrl(path) });
    } catch (error) {
      console.error("Failed to upload profile photo:", error);
      res.status(500).json({ error: "Non siamo riusciti a caricare la foto, riprova" });
    }
  },
);

// ===================== INVITES ("sali in lista") =====================

// The user's invite code, how many invited friends count, and their position.
router.get(API_ROUTE_PATHS.ME_INVITE, requireAuth, async (req: AuthenticatedRequest, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { data: row, error } = await supabaseAdmin
      .from("utenti")
      .select("codice_invito, posizione")
      .eq("id", req.userId)
      .maybeSingle();
    if (error) throw error;
    if (!row?.codice_invito) {
      res.status(404).json({ error: "Codice invito non disponibile" });
      return;
    }
    const [invitati, posizione] = await Promise.all([
      countedInvites(req.userId),
      waitlistPosition(req.userId, row.posizione),
    ]);
    res.json({ codice: row.codice_invito, invitati, bonus: WAITLIST_INVITE_BONUS, posizione });
  } catch (error) {
    console.error("Failed to load invite:", error);
    res.status(500).json({ error: "Impossibile caricare il tuo invito" });
  }
});

const inviteClaimSchema = z.object({ codice: z.string().trim().min(4).max(12) }).strict();

// Records who invited a new user. Only once, only before they finish the
// onboarding (so existing users cannot game positions), never self-invites.
router.post(API_ROUTE_PATHS.ME_INVITE_CLAIM, requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = inviteClaimSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Codice invito non valido" });
    return;
  }
  try {
    const { data: inviter, error: inviterError } = await supabaseAdmin
      .from("utenti")
      .select("id")
      .eq("codice_invito", parsed.data.codice)
      .maybeSingle();
    if (inviterError) throw inviterError;
    if (!inviter || inviter.id === req.userId) {
      res.json({ ok: false });
      return;
    }
    const { error } = await supabaseAdmin
      .from("utenti")
      .update({ invitato_da: inviter.id })
      .eq("id", req.userId)
      .is("invitato_da", null)
      .is("onboarding_completato_at", null);
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to record invite:", error);
    res.status(500).json({ error: "Impossibile registrare l'invito" });
  }
});

export default router;
