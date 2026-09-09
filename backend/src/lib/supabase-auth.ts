import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["SUPABASE_URL"];
// Same publishable/anon key the frontend uses (VITE_SUPABASE_PUBLISHABLE_KEY).
// It's safe to use here: it has no elevated privileges, same as in the browser.
const anonKey = process.env["SUPABASE_ANON_KEY"];

if (!supabaseUrl) {
  throw new Error(
    "SUPABASE_URL environment variable is required but was not provided.",
  );
}

if (!anonKey) {
  throw new Error(
    "SUPABASE_ANON_KEY environment variable is required but was not provided.",
  );
}

// Dedicated client for user-facing auth calls (signInWithPassword,
// refreshSession) that DON'T need elevated privileges.
//
// IMPORTANT: never reuse `supabaseAdmin` (the service-role client) for these
// calls. Calling `.auth.signInWithPassword()` or `.auth.refreshSession()` on
// a Supabase client sets a live user session *on that client instance*,
// regardless of `persistSession`. Since `supabaseAdmin` is a singleton shared
// by the whole process, doing this on it means every later query made with
// `supabaseAdmin` — including ones meant to bypass RLS with the service role
// — silently starts running as that logged-in user instead, until someone
// else logs in and overwrites it again. That's what caused the public
// waitlist counter (and anything else using supabaseAdmin) to collapse to
// whatever a single logged-in user's RLS-scoped view saw, right after any
// login. Keeping a separate anon-key client for these two calls means they
// can never touch supabaseAdmin's session.
export const supabaseAuthClient = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
