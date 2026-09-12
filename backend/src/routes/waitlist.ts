import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";

const router: IRouter = Router();

// Public count of rows in `utenti`, used by the marketing waitlist page so
// it shows a real number instead of a hardcoded one. `head: true` means
// Supabase returns only the count, not the rows themselves.
router.get("/waitlist/count", async (_req, res) => {
  // Never cache this: it's a live counter, and a stale cached response
  // (browser or intermediate proxy) would show an outdated number forever.
  res.set("Cache-Control", "no-store");

  try {
    const { count, error } = await supabaseAdmin
      .from("utenti")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Failed to load waitlist count:", error);
      res.status(500).json({ error: "Unable to load waitlist count" });
      return;
    }

    res.json({ count: count ?? 0 });
  } catch (err) {
    console.error("Unexpected error in waitlist count:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get the current user's position in the waitlist
router.get("/waitlist/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId } = req;

  // Debug logging
  console.log(`[waitlist/me] Fetching position for userId: ${userId}`);

  try {
    const { data, error } = await supabaseAdmin
      .from("utenti")
      .select("posizione")
      .eq("id", userId)
      .single();

    if (error) {
      console.error(`[waitlist/me] Supabase error for user ${userId}:`, error);
      res.status(500).json({ error: "Unable to load waitlist position" });
      return;
    }

    if (!data) {
      console.log(`[waitlist/me] No user record found for userId: ${userId}`);
      res.status(404).json({ error: "User not found in waitlist" });
      return;
    }

    console.log(`[waitlist/me] Found position ${data.posizione} for userId: ${userId}`);
    res.json({ position: data.posizione });
  } catch (err) {
    console.error("Error fetching waitlist position:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
