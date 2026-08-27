import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { supabaseAdmin } from "../lib/supabase-admin";

const router: IRouter = Router();

// Authoritative admin check. Reads the `admin` column on `utenti` using the
// service-role client, which bypasses RLS — this is the one place in the
// system that is allowed to see that value on the caller's behalf. The
// frontend must trust only this response, never read `utenti` directly.
router.get("/me/role", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  const { data, error } = await supabaseAdmin
    .from("utenti")
    .select("admin")
    .eq("id", userId)
    .single();

  if (error || !data) {
    // Row missing (e.g. trigger hasn't run yet) or unexpected DB error:
    // fail safe as a normal user rather than leaking error details.
    res.json({ role: "user" });
    return;
  }

  res.json({ role: data.admin ? "admin" : "user" });
});

export default router;
