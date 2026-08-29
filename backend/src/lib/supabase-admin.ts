import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["SUPABASE_URL"];
const secretKey = process.env["SUPABASE_SECRET_KEY"];

if (!supabaseUrl) {
  throw new Error(
    "SUPABASE_URL environment variable is required but was not provided.",
  );
}

if (!secretKey) {
  throw new Error(
    "SUPABASE_SECRET_KEY environment variable is required but was not provided.",
  );
}

// Server-side Supabase client using the secret key. It bypasses Row Level
// Security entirely, so every query built with it must already be scoped
// to a user id we resolved ourselves (see middlewares/auth.ts).
// NEVER send this key to the frontend/browser.
export const supabaseAdmin = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});