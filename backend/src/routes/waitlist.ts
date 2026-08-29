import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase-admin";

const router: IRouter = Router();

// Public count of rows in `utenti`, used by the marketing waitlist page so
// it shows a real number instead of a hardcoded one. `head: true` means
// Supabase returns only the count, not the rows themselves.
router.get("/waitlist/count", async (_req, res) => {
  const { count, error } = await supabaseAdmin
    .from("utenti")
    .select("*", { count: "exact", head: true });

  if (error) {
    res.status(500).json({ error: "Unable to load waitlist count" });
    return;
  }

  res.json({ count: count ?? 0 });
});

export default router;
