import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
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
      // If user record doesn't exist, return a fallback
      res.json({ position: 107 });
      return;
    }

    if (!data) {
      console.log(`[waitlist/me] No user record found for userId: ${userId}`);
      // If user record doesn't exist, return a fallback
      res.json({ position: 107 });
      return;
    }

    console.log(`[waitlist/me] Found position ${data.posizione} for userId: ${userId}`);
    res.json({ position: data.posizione ?? 107 });
  } catch (err) {
    console.error("Error fetching waitlist position:", err);
    res.json({ position: 107 });
  }
});

export default router;
