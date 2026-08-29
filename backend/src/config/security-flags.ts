/**
 * ============================================================================
 * DEVELOPMENT-ONLY SECURITY OVERRIDES — DO NOT USE IN PRODUCTION
 * ============================================================================
 *
 * This file lists every real security check currently implemented in the
 * backend. Flip a flag to `true` to temporarily suspend that specific check
 * while debugging locally (e.g. calling a protected route from curl/Postman
 * without a real login, or building the admin UI without an admin row yet).
 *
 * Safety net: every flag is force-ignored whenever NODE_ENV=production (see
 * `devOnly` below), so this file cannot silently become a real backdoor if
 * it ever ships. Still: never commit this file with a flag set to `true`,
 * and never rely on the production check alone — treat these as local-only.
 *
 * Inventory of security techniques currently in this codebase:
 *   1. JWT verification on protected routes (middlewares/auth.ts) — every
 *      request must carry a bearer token that Supabase confirms belongs to
 *      a real, currently valid session. A client can never just claim a
 *      user id.
 *   2. Server-side-only admin check (routes/me.ts) — whether the caller is
 *      an admin is decided by the backend reading the `admin` column with
 *      the Supabase service-role key, which bypasses RLS. The frontend
 *      never reads that column directly and can't see or infer another
 *      user's admin flag.
 *   3. Fail-safe defaults — if the admin lookup errors or the row doesn't
 *      exist yet, the caller is treated as a normal user, never as admin.
 *   4. Secret isolation — the Supabase service-role key only ever lives in
 *      the backend's environment (backend/.env); the frontend only ever
 *      holds the public anon/publishable key (frontend/.env). This one is
 *      architectural and has no runtime flag here — there's nothing to
 *      "suspend", since the frontend build simply never contains the key.
 *   5. Email confirmation on sign-up — see REQUIRE_EMAIL_CONFIRMATION below.
 *      Note: whether Supabase itself asks for confirmation is really a
 *      *project* setting (Dashboard → Authentication → Providers → Email →
 *      "Confirm email"); this file can't reach into Supabase and flip that
 *      switch. What this flag controls is which code path *our own app*
 *      uses: the normal client-side `supabase.auth.signUp()` (which always
 *      follows the dashboard setting, and can hit Supabase's shared
 *      email-sending rate limit), or a backend route that creates the user
 *      already confirmed via the admin API and never sends an email at all.
 *
 * There is currently no "limit account creation from the same device"
 * check anywhere in this codebase (frontend or backend) — searched both for
 * device/fingerprint/rate-limit logic and found none. If you want that
 * behavior, it needs to be built first; nothing here can toggle a check
 * that doesn't exist yet.
 */

const isProduction = process.env["NODE_ENV"] === "production";

function devOnly(flagValue: boolean, flagName: string): boolean {
  if (flagValue && isProduction) {
    // eslint-disable-next-line no-console
    console.warn(
      `[security-flags] "${flagName}" is set to true but NODE_ENV=production — ` +
        "ignoring it and enforcing the real security check instead.",
    );
    return false;
  }
  return flagValue;
}

const rawFlags = {
  /**
   * Real check being suspended: `requireAuth` in
   * backend/src/middlewares/auth.ts, which rejects any request missing a
   * valid Supabase bearer token.
   *
   * When true: every route behind `requireAuth` is treated as already
   * authenticated as DEV_USER (below), without checking any token at all.
   */
  SKIP_AUTH_TOKEN_CHECK: false,

  /**
   * Real check being suspended: the `admin` column lookup in
   * backend/src/routes/me.ts, which normally decides admin vs. user from
   * the database and fails safe to "user" on any error.
   *
   * When true: GET /me/role always answers "admin", for every caller,
   * regardless of the database or of SKIP_AUTH_TOKEN_CHECK above.
   */
  FORCE_ADMIN_ROLE: false,

  /**
   * Whether new accounts must confirm their email before the app treats
   * them as fully registered.
   *
   * true  (default): registration keeps using the frontend's normal
   *        `supabase.auth.signUp()` call (frontend/src/pages/register.tsx),
   *        unchanged. Confirmation is required or not purely based on your
   *        Supabase project's own "Confirm email" dashboard setting, and
   *        signups can hit Supabase's shared email rate limit like today.
   *
   * false: registration instead goes through POST /api/auth/register
   *        (routes/register.ts), which creates the user already confirmed
   *        via the Supabase admin API. No confirmation email is ever sent,
   *        so the rate limit is never touched, and the user is logged in
   *        immediately. Trade-off: anyone can register with any email
   *        address, including one they don't own — fine for local
   *        dev/testing, not something to leave off for real users without
   *        thinking it through.
   *
   * Unlike the two flags above, this one is NOT forced back to `true` in
   * production — plenty of real apps intentionally skip email confirmation
   * for lower signup friction. Decide this one deliberately either way.
   */
  REQUIRE_EMAIL_CONFIRMATION: true,
} as const;

export const securityFlags = {
  skipAuthTokenCheck: devOnly(rawFlags.SKIP_AUTH_TOKEN_CHECK, "SKIP_AUTH_TOKEN_CHECK"),
  forceAdminRole: devOnly(rawFlags.FORCE_ADMIN_ROLE, "FORCE_ADMIN_ROLE"),
  requireEmailConfirmation: rawFlags.REQUIRE_EMAIL_CONFIRMATION,
};

// Identity used to fill in for a real user when SKIP_AUTH_TOKEN_CHECK is on.
export const devUser = {
  id: "dev-user-id",
  email: "dev@localhost",
};
