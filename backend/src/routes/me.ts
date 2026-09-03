import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { supabaseAdmin } from "../lib/supabase-admin";
import { securityFlags } from "../config/security-flags";

const router: IRouter = Router();

// Authoritative admin check. Reads the `admin` column on `utenti` using the
// service-role client, which bypasses RLS — this is the one place in the
// system that is allowed to see that value on the caller's behalf. The
// frontend must trust only this response, never read `utenti` directly.
router.get("/me/role", requireAuth, async (req, res) => {
  // DEBUG ONLY — see backend/src/config/security-flags.ts. When on, every
  // caller is reported as admin regardless of the database. Forced off in
  // production.
  if (securityFlags.forceAdminRole) {
    res.json({ role: "admin" });
    return;
  }

  const { userId } = req as AuthenticatedRequest;

  const { data, error } = await supabaseAdmin
    .from("utenti")
    .select("admin")
    .eq("id", userId)
    .single();

  if (error || !data) {
    // Nessun record in utenti trovato - creiamolo ora dai dati di Supabase Auth
    try {
      // Recupera l'utente da Supabase Auth (incluso il metadata)
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

      if (authError || !authUser) {
        // Impossibile recuperare l'utente auth, fallisce sicuro come utente normale
        res.json({ role: "user" });
        return;
      }

      // Estrai nome e cognome dal metadata (con valori di default vuoti)
      const { nome = "", cognome = "" } = authUser.user.user_metadata ?? {};
      const full_name = `${nome} ${cognome}`.trim();

      // Inserisci il nuovo record in utenti
      const { error: insertError } = await supabaseAdmin
        .from("utenti")
        .insert({
          id: userId,
          nome,
          cognome,
          full_name,
          // Altri campi con valori di default sicuri
          // admin: false è il valore predefinito per i nuovi utenti
          // created_at/updated_at verranno gestiti dal database se hanno DEFAULT
        });

      if (insertError) {
        // Se l'inserimento fallisce, logga l'errore e fallisce sicuro come utente normale
        console.error("Failed to create utenti record:", insertError);
        res.json({ role: "user" });
        return;
      }

      // Ora recupera il record appena creato per determinare il ruolo
      // (i nuovi utenti non sono admin per impostazione predefinita)
      const { data: newData, error: newError } = await supabaseAdmin
        .from("utenti")
        .select("admin")
        .eq("id", userId)
        .single();

      if (newError || !newData) {
        res.json({ role: "user" });
        return;
      }

      res.json({ role: newData.admin ? "admin" : "user" });
      return;
    } catch (err) {
      console.error("Error in utenti lazy creation:", err);
      res.json({ role: "user" });
      return;
    }
  }

  res.json({ role: data.admin ? "admin" : "user" });
});

export default router;