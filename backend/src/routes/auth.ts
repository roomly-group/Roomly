import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { securityFlags } from "../config/security-flags.js";

const router: IRouter = Router();

// Lets the frontend ask, before submitting the registration form, which
// sign-up flow it should use — see security-flags.ts.
router.get("/auth/config", (_req, res) => {
  res.json({ requireEmailConfirmation: securityFlags.requireEmailConfirmation });
});

// DEBUG-PATH REGISTRATION — only meant to be used while
// REQUIRE_EMAIL_CONFIRMATION is false (backend/src/config/security-flags.ts).
// Creates the user already confirmed via the admin API (which never sends a
// confirmation email, so it never touches Supabase's shared email rate
// limit) and signs them in immediately.
router.post("/auth/register", async (req, res) => {
  if (securityFlags.requireEmailConfirmation) {
    res.status(409).json({
      error:
        "Email confirmation is required. Use supabase.auth.signUp() from the frontend instead of this route.",
    });
    return;
  }

  const { nome, cognome, email, password } = (req.body ?? {}) as {
    nome?: string;
    cognome?: string;
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nome: nome ?? "",
      cognome: cognome ?? "",
      full_name: `${nome ?? ""} ${cognome ?? ""}`.trim(),
    },
  });

  if (createError || !created.user) {
    res.status(400).json({ error: createError?.message ?? "Unable to create user" });
    return;
  }

  // Sign the brand-new user in so the frontend gets back a real session,
  // the same shape it would get from a normal supabase.auth.signUp().
  const { data: signedIn, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signedIn.session) {
    res.status(500).json({ error: "User created but sign-in failed" });
    return;
  }

  res.status(201).json({ session: signedIn.session, user: signedIn.user });
});

export default router;
