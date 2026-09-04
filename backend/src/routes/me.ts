import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";

const router: IRouter = Router();

// Crea il record in "utenti" per un utente che ha fatto login ma non ha
// ancora una riga (lazy creation). "posizione" è una colonna IDENTITY:
// il database la assegna da solo, non va mai scritta a mano.
async function ensureUtenteRecord(userId: string) {
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (authError || !authUser) {
    return null;
  }

  const { email_confirmed_at } = authUser.user;
  if (!email_confirmed_at) {
    return null;
  }

  const { nome = "", cognome = "" } = authUser.user.user_metadata ?? {};

  const { error: insertError } = await supabaseAdmin.from("utenti").insert({
    id: userId,
    email: authUser.user.email ?? "",
    nome,
    cognome,
    email_verificata: true,
  });

  if (insertError) {
    console.error("Failed to create utenti record:", insertError);
    return null;
  }

  const { data: newRow, error: newError } = await supabaseAdmin
    .from("utenti")
    .select("nome, cognome, email, posizione, admin, owner, lingua")
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
router.get("/me/role", requireAuth, async (req, res) => {
  const { userId } = req;

  const { data, error } = await supabaseAdmin
    .from("utenti")
    .select("admin, owner")   // <-- aggiunto owner
    .eq("id", userId)
    .single();

  if (error || !data) {
    const created = await ensureUtenteRecord(userId);
    res.json({
      role: created?.admin ? "admin" : "user",
      owner: created?.owner === true,
    });
    return;
  }

  res.json({
    role: data.admin ? "admin" : "user",
    owner: data.owner === true,
  });
});

// Restituisce i dati reali del profilo dell'utente autenticato,
// creando il record in "utenti" se non esiste ancora.
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId } = req;

  const { data, error } = await supabaseAdmin
    .from("utenti")
    .select("nome, cognome, email, posizione, lingua")
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
      full_name: `${created.nome ?? ""} ${created.cognome ?? ""}`.trim(),
    });
    return;
  }

  res.json({
    ...data,
    full_name: `${data.nome ?? ""} ${data.cognome ?? ""}`.trim(),
  });
});
const SUPPORTED_LANGUAGES = ["en", "it", "es", "fr", "de", "pt"];

// Salva la lingua scelta manualmente dall'utente.
router.patch("/me/language", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId } = req;
  const { language } = req.body as { language?: string };

  if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
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

export default router;