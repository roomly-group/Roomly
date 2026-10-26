import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { ensureUtenteRecord } from "../lib/utenti.js";
import { signedProfilePhotoUrl } from "../lib/profile-photo.js";
import { waitlistPosition } from "../lib/waitlist.js";
import {
  API_ROUTE_PATHS,
  DEFAULT_USER_PREFERENCES,
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

export default router;