import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import {
  API_ROUTE_PATHS,
  DEFAULT_USER_PREFERENCES,
  SUPPORTED_LANGUAGE_CODES,
  USER_PREFERENCE_OPTIONS,
} from "@workspace/api-zod";
import { z } from "zod";

const router: IRouter = Router();

// Crea il record in "utenti" per un utente che ha fatto login ma non ha
// ancora una riga (lazy creation), es. quando questa route viene chiamata
// prima che il trigger `handle_email_confirmed` su auth.users abbia fatto
// in tempo a inserirla.
//
// IMPORTANTE: "posizione" NON è una colonna IDENTITY, è un BIGINT DEFAULT 0
// (vedi migration 202609040001). Se qui non calcoliamo esplicitamente il
// valore, la riga viene creata con posizione = 0, e quando il trigger del
// DB prova a inserirla a sua volta trova già la riga (ON CONFLICT DO
// NOTHING) e non la corregge più: l'utente resta bloccato a una posizione
// finta. Per questo calcoliamo qui la stessa logica del trigger.
async function ensureUtenteRecord(userId: string) {
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (authError || !authUser) {
    return null;
  }

  const { email_confirmed_at } = authUser.user;
  if (!email_confirmed_at) {
    return null;
  }

  const { nome = "", cognome = "", data_nascita = null } = authUser.user.user_metadata ?? {};

  const { data: maxRow } = await supabaseAdmin
    .from("utenti")
    .select("posizione")
    .order("posizione", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosizione = (maxRow?.posizione ?? 0) + 1;

  // First, check if a record already exists
  const { data: existingUtente, error: selectError } = await supabaseAdmin
    .from("utenti")
    .select("data_nascita")
    .eq("id", userId)
    .single();

  // If we got an error that is not because the record doesn't exist, return null
  if (selectError && selectError.code !== 'PGRST116') {
    console.error("Failed to fetch utenti record:", selectError);
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
      data_nascita,
    });

    if (insertError) {
      console.error("Failed to create utenti record:", insertError);
      return null;
    }
  } else {
    // Record exists - check if we need to update data_nascita
    if (
      existingUtente &&
      existingUtente.data_nascita === null &&
      data_nascita !== null &&
      data_nascita !== ''
    ) {
      const { error: updateError } = await supabaseAdmin
        .from("utenti")
        .update({ data_nascita })
        .eq("id", userId);

      if (updateError) {
        console.error("Failed to update utenti record with data_nascita:", updateError);
        return null;
      }
    }
    // If data_nascita is already set, we do nothing
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

  const { data, error } = await supabaseAdmin
    .from("utenti")
    .select("nome, cognome, email, posizione, lingua, data_nascita")
    .eq("id", userId)
    .single();

  if (error || !data) {
    const created = await ensureUtenteRecord(userId);

    if (!created) {
      res.status(404).json({ error: "Profilo non trovato" });
      return;
    }

    res.json({
      nome: created.nome,
      cognome: created.cognome,
      email: created.email,
      posizione: created.posizione,
      lingua: created.lingua,
      data_nascita: created.data_nascita,
      full_name: `${created.nome ?? ""} ${created.cognome ?? ""}`.trim(),
    });
    return;
  }

  res.json({
    ...data,
    full_name: `${data.nome ?? ""} ${data.cognome ?? ""}`.trim(),
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