import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";

const router: IRouter = Router();

// Lets the frontend ask, before submitting the registration form, which
// sign-up flow it should use — email confirmation is always required.
router.get("/auth/config", (_req, res) => {
  res.json({ requireEmailConfirmation: true });
});

// Registration must be done via the frontend's supabase.auth.signUp()
// to ensure email confirmation flow is respected.
router.post("/auth/register", async (_req, res) => {
  res.status(409).json({
    error:
      "Email confirmation is required. Use supabase.auth.signUp() from the frontend instead of this route.",
  });
});

export default router;