# Roomly: Security & QA Audit Report

**Date:** 2026-11-09
**Scope:** static, read-only review of the repository at commit `8166cbb` (branch `main`): `backend/` (Express on Railway), `frontend/` (Vite + React on Vercel), `backend/migrations/`, the deleted migrations still in git history, and `claude_workspace/database.sql` (schema reference).
**Not in scope / not possible:** the live Supabase database, RLS policies, storage buckets, Auth settings, Vercel/Railway dashboards. Anything that depends on them is marked **UNVERIFIED** and listed under [Manual checks for me](#5-manual-checks-for-me).

**Commands run (all read-only):** `git log/show/grep`, `grep`, `tsc --noEmit --incremental false` (backend and frontend, nothing written), `npm audit --json` (backend and frontend, approved by you; no fixes applied). No `.env*` file was opened. No source file was changed.

---

## 1. Executive summary

**Overall risk: MEDIUM-HIGH.**
The application code is better than average. Every route that takes an ID checks ownership on the server, request transitions are atomic, uploads are re-encoded, and the service-role key never reaches the browser. The main risks are:

- **Things the code can't show.** The backend bypasses RLS with the service-role key, so the code is safe. But the browser receives a real user JWT plus the public anon key. If any table, function or bucket in Supabase is still open, a user can skip the backend entirely. A few clues in git history make this a real concern (see U-1 to U-4).
- **GDPR gaps.** There is no account deletion and no data export. ID documents and face videos are kept indefinitely for model training.
- **Abuse controls.** IP rate limits can be bypassed. Suspended accounts are not enforced anywhere. There is no report or block feature.

### Top 5 issues

| # | Issue | Why it matters |
|---|---|---|
| 1 | **U-1 / U-2 (UNVERIFIED, potentially Critical):** `utenti` may let users UPDATE their own row, and DB functions such as `libera_stanza(p_stanza_id, p_owner_id)` may be callable by anyone. | If either is open, any signed-in user could make themselves `admin = true`, or free any owner's rented room, with one HTTP call to Supabase. Check this first (SQL in §5). |
| 2 | **RMY-01:** `trust proxy: true` plus the public Railway URL lets anyone bypass the login, signup and refresh rate limits by faking `X-Forwarded-For`. | Brute force and credential stuffing. The CAPTCHA is the only remaining defence, and whether it is enabled is UNVERIFIED. |
| 3 | **RMY-02:** there is no account deletion and no data export anywhere in the app. | GDPR Art. 15, 17 and 20 (right of access, erasure, portability). Users in Italy can complain to the Garante. |
| 4 | **RMY-03:** ID documents and face videos are kept with no time limit when the user ticks "training" consent, and are orphaned in storage if the user is deleted. | Special-category (biometric) data. Needs a DPIA, a retention limit and a deletion path. |
| 5 | **RMY-05:** `/api/verify` returns the access and refresh tokens to JavaScript, and Google login uses the implicit flow (tokens in the URL). | This removes the protection of the HttpOnly cookies: any XSS, or a malicious browser extension, can steal a 30-day session. It also makes U-1 and U-2 easy to exploit. |

### Counts by severity

| Severity | Confirmed in code | UNVERIFIED (needs dashboard) |
|---|---|---|
| Critical | 0 | 2 possible (U-1, U-2) |
| High | 3 | 2 possible (U-3, U-4) |
| Medium | 10 | 1 (U-5) |
| Low | 12 | 2 (U-6, U-7) |
| Info | 3 | — |

### What stayed UNVERIFIED
- **U-1:** RLS and policies on `utenti`, `preferenze_utenti`, `universita`, `stanze_foto` and `messages`. In particular, whether `authenticated` can UPDATE `utenti` (the trigger in history protects only `owner`, not `admin`).
- **U-2:** `EXECUTE` grants and `SECURITY DEFINER` status of `libera_stanza`, `accetta_richiesta`, `rifiuta_richiesta` and `annulla_richiesta`.
- **U-3:** the storage buckets `foto_stanze`, `foto_profilo` and `verifiche_identita`: public flag, size and MIME limits, `storage.objects` policies.
- **U-4:** Supabase Auth settings: CAPTCHA, email confirmation, secure email change, password policy, leaked-password protection, redirect allowlist, auth rate limits.
- **U-5:** `NODE_ENV=production` on Railway (affects CORS, cookie `Secure`, stack traces).
- **U-6:** the live type of `utenti.posizione` (the schema says `GENERATED ALWAYS AS IDENTITY`, but the code inserts explicit values).
- **U-7:** Geoapify and CARTO key restrictions, and whether the server and browser share one Geoapify key.

---

## Phase 1: App map

**Data flow:** the browser calls relative `/api/*`. `frontend/vercel.json:3` rewrites that to `https://roomly-production-67d0.up.railway.app/api/*` (Express). Express calls Supabase with **`supabaseAdmin` (service role, bypasses RLS)** for every table and storage call.

- The browser uses Supabase **only for `auth.*`**. The agents found no `.from()`, `.rpc()`, `.storage` or `.channel()` calls in `frontend/`.
- So protection lives **in backend code**. RLS is only a second line of defence, but it is the **only** defence against someone calling Supabase REST directly with the anon key plus their own JWT, which the frontend holds in memory.

**Supabase clients**

| Client | File | Key | Used for |
|---|---|---|---|
| `supabaseAdmin` | `backend/src/lib/supabase-admin.ts:22` | `SUPABASE_SECRET_KEY` (service role) | All DB and storage calls, `auth.getUser`, `auth.admin.*` |
| `supabaseAuthClient` / `createRequestAuthClient` | `backend/src/lib/supabase-auth.ts:35,44` | `SUPABASE_ANON_KEY` | `signInWithPassword`, `signUp`, `refreshSession` |
| `supabase` (browser) | `frontend/src/lib/supabase.ts:56-62` | `VITE_SUPABASE_PUBLISHABLE_KEY` | `getSession`, `setSession`, `signInWithOAuth`, `signOut`, `updateUser({email})`; `persistSession:false`, implicit flow |

**Backend endpoints** (prefix `/api`; "auth" = `requireAuth`, which verifies the JWT on the server with `supabaseAdmin.auth.getUser` and caches it for 60 s)

| Area | Endpoints | Guard |
|---|---|---|
| Auth | `POST /login` `/register` `/refresh` `/session` `/verify` `/logout`, `GET /csrf` `/config` | login/register/refresh rate-limited by IP; CSRF header on `/refresh` and `/session` only |
| Public | `GET /healthz`, `/waitlist/count`, `/universita` | none |
| Listings | `GET /listings`, `/listings/:id` | auth + `requireAppAccess` (admin or owner only, pre-launch) |
| Owner | `POST /listings`, `GET/PUT/DELETE /owner/listings/:id`, `POST/DELETE /owner/listings/:id/photos[/:photoId]`, `POST /listings/:id/release`, `GET /dashboard/owner` | auth + ownership in the query (`.eq("proprietario_id", userId)`) |
| Chat | `GET/POST /conversations`, `GET/POST /conversations/:id/messages`, `POST …/accept` `…/reject` `…/cancel`, `DELETE /conversations/:id` | auth + membership or role check in code; per-user rate limits |
| Contracts | `GET/POST /owner/contracts`, `GET /owner/contracts/export`, `POST /owner/contracts/:id/status` | auth + `requireOwnerAccount` + `proprietario_id` filter |
| Me | `GET /me`, `/me/role`, `/me/onboarding`, `/me/invito`; `PATCH /me/profile` `/me/language` `/me/onboarding`; `PUT /me/preferences`; `POST /me/photo`, `/me/invito/usa` | auth, scoped to `req.userId` |
| Verification | `GET/POST /me/verification`, `POST /me/verification/document/:side` `/video` `/submit` `/training-consent` | auth, scoped to the user |
| Admin | `GET /admin/stats`, `/admin/verifications`, `POST /admin/verifications/:id/decision` | auth + `requireAdmin` (reads `utenti.admin` on every call, no cache) |

**Storage buckets:** `foto_stanze` (room photos), `foto_profilo` (profile photos), `verifiche_identita` (ID documents and videos). All are written only by the backend and read through signed URLs (1 h, 1 h and 15 min).
**RPC:** `libera_stanza`, `posizione_in_lista`. **Realtime:** none; chat polls every 4 s and 10 s with React Query.

**Env variable names**
- **Server:** `PORT`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_ANON_KEY`, `GEOAPIFY_API_KEY`, `SEARCH_RADIUS_KM`, `LOG_LEVEL`, `NODE_ENV`.
- **Browser:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TURNSTILE_SITE_KEY`, `VITE_GEOAPIFY_API_KEY`, `VITE_CARTO_API_KEY`.
- No secret-looking name has a `VITE_` prefix. `.env` and `.env.*` are gitignored (`.gitignore:69-71`), and no `.env` is tracked.

**User input entry points:**
- JSON bodies: login/register, onboarding, profile, preferences, listing create/update, messages, contracts, verification start/decision, invite claim.
- Raw upload bodies: room photo, profile photo, ID front/back, ID video.
- Query strings: `zone`, `maxPrice`, `furnished`, `after`, `before`, `status`.
- Path IDs: listing, photo, conversation, contract, verification.
- Cookies. URL hash (OAuth tokens).

---

## 2. Findings (sorted by severity)

Format: **ID — Title** · Category · Severity · Confidence · Effort (S/M/L).
The fixes are proposals only. **Nothing was applied.**

### UNVERIFIED items that could be Critical or High (check these first)

#### U-1 — Users may be able to edit protected columns of `utenti`, including `admin` · Security · **Potentially Critical** · UNVERIFIED · S
- **Why suspect it:**
  - The only protection for role flags in the repo is the trigger `prevent_untrusted_owner_flag_change` (deleted migration `003_protect_owner_flag.sql`, visible with `git show 501d406^:backend/migrations/003_protect_owner_flag.sql`). It blocks changes to **`owner` only**.
  - `admin`, `stato`, `email_verificata`, `tipo_utente` and `email` have no trigger.
  - No migration in the repo enables RLS on `utenti` or defines its policies.
  - The browser holds a valid user JWT (`/api/verify` returns it, see RMY-05), and the anon key is public.
- **Exploit, if `utenti` has a typical "users can update their own row" policy, or RLS is off:**
  ```
  PATCH {SUPABASE_URL}/rest/v1/utenti?id=eq.<my-uuid>
  apikey: <publishable key>   Authorization: Bearer <my access token>
  {"admin": true}
  ```
  The next `requireAdmin` check (`backend/src/middleware/auth.ts:83`) passes. The attacker then sees every identity document and video through `/api/admin/verifications`, and can approve their own fake verification.
- **If RLS is OFF on `utenti`:** anyone with only the anon key can `GET /rest/v1/utenti?select=*` and read every user's email, phone, date of birth, gender and nationality.
- **Fix:** follow the model of migrations 008, 010 and 011 (RLS on, no policies, `REVOKE ALL … FROM anon, authenticated`) for `utenti`, `preferenze_utenti`, `stanze_foto` and `messages`. The frontend never reads them directly, so nothing breaks. Also extend the trigger to `admin`, `stato`, `email_verificata` and `tipo_utente`.
  ```sql
  ALTER TABLE public.utenti ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.utenti, public.preferenze_utenti, public.stanze_foto FROM anon, authenticated;
  ```

#### U-2 — Room-request DB functions may be executable by anyone · Security · **Potentially Critical** · UNVERIFIED · S
- **Why suspect it:**
  - `libera_stanza(p_stanza_id, p_owner_id)` trusts the **owner id passed as a parameter** (`backend/src/lib/rooms.ts:12-16`).
  - The only version in history (`005_room_requests.sql:350`, `git show 5e3b137^:…`) runs `revoke execute … from anon, authenticated`. In Postgres, functions are executable by **`PUBLIC`** by default, and `anon` and `authenticated` inherit from `PUBLIC`, so that revoke alone does not lock it.
  - The live function raises codes `RM001`, `RM005` and `RM006` (`lib/rooms.ts:7-9`, `routes/roomly.ts:829-832`), which do not appear in any SQL in the repo. So the live definition, including whether it is `SECURITY DEFINER`, is unknown.
  - Migration 007 does it correctly: `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` (`007_inviti.sql:50`).
- **Exploit, if the live function is `SECURITY DEFINER` and executable through PUBLIC:**
  1. Read an owner's UUID: it is returned as `ownerId` by `GET /api/listings/:id` (`routes/roomly.ts:131`).
  2. Call `POST /rest/v1/rpc/libera_stanza {"p_stanza_id": N, "p_owner_id": "<owner uuid>"}`.
  3. The rented room flips back to `disponibile`, the accepted request is cancelled, and system messages are posted.
  4. The same applies to `accetta_richiesta`, `rifiuta_richiesta` and `annulla_richiesta` if they still exist.
- **Fix:**
  ```sql
  REVOKE EXECUTE ON FUNCTION public.libera_stanza(bigint, uuid) FROM PUBLIC, anon, authenticated;
  -- same for accetta_richiesta, rifiuta_richiesta, annulla_richiesta (or DROP them if unused)
  GRANT EXECUTE ON FUNCTION public.libera_stanza(bigint, uuid) TO service_role;
  ```
  Commit the current definition of `libera_stanza` as a migration so it can be reviewed.

#### U-3 — Storage bucket settings and policies are not in the repo · Security/Privacy · **Potentially High** · UNVERIFIED · S
- No migration creates `foto_stanze`. `getRoomPhotoPath` still parses `/object/public/foto_stanze/` URLs (`routes/roomly.ts:73-86`), which suggests the bucket was **public** at some point.
- `foto_profilo` and `verifiche_identita` are created with `ON CONFLICT (id) DO NOTHING` (`006_onboarding.sql`, `011_verifiche_identita.sql`). A bucket that already existed keeps its old settings.
- Any `storage.objects` policy that allows `authenticated` to list or upload would bypass all the backend checks (size, re-encoding, path). For `verifiche_identita` it would also expose ID documents.
- **Fix:** all three buckets private, no `storage.objects` policies for `anon` or `authenticated`. See §5.

#### U-4 — Supabase Auth settings are the real backstop for several findings · Security · **Potentially High** · UNVERIFIED · S
- RMY-01 (rate-limit bypass) depends on CAPTCHA being on in Supabase.
- RMY-06 depends on "Secure email change".
- RMY-14 depends on email confirmation (user enumeration).
- Password strength is only checked in the UI (`register.tsx:21,53`). The backend accepts any password Supabase accepts.
- See §5 for exact settings.

#### U-5 — `NODE_ENV` must be `production` on Railway · Security · Medium · UNVERIFIED · S
`lib/origins.ts:11`, `routes/auth.ts:30` and `lib/logger.ts:3` switch on it:
- CORS allowlist
- `Secure` cookie flag
- pino-pretty, which is a devDependency: the app crashes at startup if it is missing
- Express stack traces in 500 pages

#### U-6 — `utenti.posizione` schema drift · Bug · Low · UNVERIFIED · S
- `claude_workspace/database.sql` declares `posizione bigint GENERATED ALWAYS AS IDENTITY`.
- `backend/src/lib/utenti.ts:52-60` inserts an explicit `posizione`, and the comment at `utenti.ts:8-13` says it is `BIGINT DEFAULT 0`.
- If the schema file is right, every lazy profile creation fails with error `428C9`, and `/api/me` answers 404 "Profilo non trovato" for users the trigger missed.

#### U-7 — Third-party API keys in the browser bundle · Leak · Low · UNVERIFIED · S
- `VITE_GEOAPIFY_API_KEY` (`AddressAutocomplete.tsx:39`) and `VITE_CARTO_API_KEY` (`listing-map.tsx:13-15`) are public by design.
- `backend/scripts/geocode-universities.ts:13` falls back to `VITE_GEOAPIFY_API_KEY`, which suggests **one Geoapify key may be shared** between the server and the browser.
- **Fix:** use separate keys, and restrict the browser key by HTTP referrer (`www.roomly.group`) in each provider's dashboard.

---

### HIGH

#### RMY-01 — Login, signup and refresh rate limits can be bypassed by faking the client IP · Security · High · Confidence: Medium-High · M
- **Where:**
  - `backend/src/app.ts:39` `app.set('trust proxy', true)`
  - `backend/src/middleware/rateLimit.ts:27-29` (`req.ip`), `:42-46` (login key `ip:email`)
  - `frontend/vercel.json:3`, which publishes the Railway origin
- **What's wrong:**
  - With `trust proxy: true`, Express takes `req.ip` from the **left-most** `X-Forwarded-For` value, which the client controls.
  - The backend is reachable directly at the Railway URL (`roomly-production-67d0.up.railway.app`), skipping Vercel. An attacker can send `X-Forwarded-For: <random>` on every request, and every IP-keyed limiter (`loginLimiter`, `signupLimiter`, `refreshLimiter`) sees a new client each time.
  - Even without spoofing, `loginLimiter` keys on `ip:email`, so one IP can try 10 passwords on **each** of an unlimited number of emails (credential stuffing).
  - express-rate-limit v8 flags this configuration itself (`ERR_ERL_PERMISSIVE_TRUST_PROXY`).
  - `/verify` has no limiter.
- **Exploit:**
  ```bash
  for i in $(seq 1 10000); do
    curl -s https://roomly-production-67d0.up.railway.app/api/login \
      -H "X-Forwarded-For: 10.0.$((i/250)).$((i%250))" \
      -H 'Content-Type: application/json' \
      -d '{"email":"victim@…","password":"guess'$i'","captchaToken":"x"}'
  done
  ```
  Only the Supabase CAPTCHA check stops this, and whether it is enabled is UNVERIFIED (U-4).
- **Fix:**
  ```diff
  - app.set('trust proxy', true);
  + // Exact number of proxies in front of the app (Vercel → Railway edge). Verify once by logging req.ips.
  + app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  ```
  ```diff
  + /** Per-account login limiter, independent of IP: stops distributed guessing on one email. */
  + export const loginEmailLimiter = rateLimit({
  +   windowMs: RATE_LIMIT_WINDOW_15_MINUTES_MS,
  +   max: LOGIN_RATE_LIMIT_MAX_REQUESTS,
  +   keyGenerator: (req) => `email:${String(req.body?.email ?? '').trim().toLowerCase()}`,
  +   standardHeaders: true, legacyHeaders: false,
  + });
  ```
  - Mount it next to `loginLimiter` in `routes/auth.ts:91`, and add `refreshLimiter` to `/verify`.
  - Best of all, stop direct traffic to Railway: either put the API on `api.roomly.group` with a single, known proxy hop, or require a secret header that only the Vercel proxy adds.
  - Keep "Enable CAPTCHA protection" on in Supabase.

#### RMY-02 — No account deletion and no personal-data export (GDPR Art. 15, 17, 20) · Privacy · High · Confidence: High · L
- **Where:**
  - No route in `backend/src/routes/*` deletes a user or exports data (no `auth.admin.deleteUser` anywhere).
  - The frontend has no such UI. `frontend/src/lib/legal-content.ts:112,205` only tells users to send an email.
- **What's wrong:**
  - Users in Italy have the right to erasure and to a copy of their data.
  - Manual deletion is also error-prone. `contratti` uses `ON DELETE RESTRICT` (`010_contratti.sql`). `verifiche_identita` uses `ON DELETE CASCADE`, which **deletes the rows holding the file paths but leaves the ID files in storage** (`011_verifiche_identita.sql`). Profile and room photos are never cleaned up either.
- **Fix:** add `DELETE /api/me` (re-authentication required). It should:
  1. Refuse while a contract is active, or anonymise the contract party instead.
  2. Remove storage files: `foto_profilo/<uid>/*`, `verifiche_identita/<uid>/*`, and the room photos of owned rooms.
  3. Delete or anonymise messages, conversations, preferences and listings.
  4. Delete the `utenti` row.
  5. Call `supabaseAdmin.auth.admin.deleteUser(uid)`.
  6. Clear the cookies.

  Also add `GET /api/me/export`, which returns the JSON of the user's rows. Effort: L.

#### RMY-03 — ID documents and face videos kept indefinitely for AI training · Privacy · High · Confidence: High (code facts; the legal assessment needs your DPO or lawyer) · M
- **Where:**
  - `backend/src/routes/verification.ts:268-275` stores `consenso_addestramento`.
  - The purge only touches rows where `consenso_addestramento = false` (`backend/src/lib/verification.ts:132-139`), so files of consenting users are never deleted.
  - Videos are 30 MB challenge recordings of the face (`verification.ts:340-374`).
- **What's wrong:**
  - Face video plus ID document used to train a verification model is biometric data processed to identify people: **GDPR Art. 9** special category.
  - It needs explicit, separate, freely-given consent; a DPIA (Art. 35); a defined retention period; and a published retention period in the privacy policy.
  - Indefinite retention also makes any breach of the bucket (see U-3) far more serious.
  - If an account is deleted, the cascade orphans the files (see RMY-02).
- **Fix:**
  - Set a maximum retention even with consent, for example 12 months:
    ```diff
      .eq("consenso_addestramento", false)
    + // add a second query: consenting users' files older than VERIFICATION_TRAINING_RETENTION_DAYS
    ```
  - Make training consent **off by default** and separate from the verification consent. Check this in `frontend/src/pages/verification.tsx`.
  - Document the processing in `privacy.tsx`, and do the DPIA.
  - Delete files before the `utenti` row is removed.

---

### MEDIUM

#### RMY-04 — Suspended or deleted accounts are never blocked; unverified email is never checked · Security · Medium · High · M
- **Where:** `backend/src/middleware/auth.ts:39-73`. `requireAuth` only validates the JWT. `grep` finds **no** use of `utenti.stato` (`sospeso`/`eliminato`) or `email_verificata` anywhere in `backend/src` or `frontend/src`.
- **What's wrong:** if you set `stato = 'sospeso'` on a scammer, they can still send messages (`chat.ts:422`), create listings (`roomly.ts:352`), accept requests and upload files. Nothing in the app can set `stato` anyway.
- **Fix:** read `stato` in `requireAuth` (cache it like `appAccessCache`) and return 403 when it isn't `attivo`. For immediate effect, also ban in Supabase Auth (`auth.admin.updateUserById(id, { ban_duration })`).
  ```diff
  +  const { data: account } = await supabaseAdmin.from("utenti").select("stato").eq("id", data.user.id).maybeSingle();
  +  if (account && account.stato !== "attivo") { res.status(403).json({ error: "Account suspended" }); return; }
  ```

#### RMY-05 — Session tokens are readable by JavaScript; OAuth uses the implicit flow · Security · Medium · High · M
- **Where:**
  - `backend/src/routes/auth.ts:243-253` and `:277-288` return `access_token` and `refresh_token` in the JSON from `/verify`.
  - `frontend/src/main.tsx:28-30`, `login.tsx:87-91` and `register.tsx:97-98` call `supabase.auth.setSession(session)`.
  - `frontend/src/lib/supabase.ts:41,56-62`: `detectSessionInUrl: true` with no `flowType`, so the implicit flow puts `#access_token=…&refresh_token=…` in the URL after Google login and email confirmation.
- **What's wrong:**
  - The HttpOnly cookies are pointless when the same tokens are returned to page JavaScript. Any XSS or malicious extension can read a refresh token valid for up to 30 days (`auth.ts:22`).
  - Tokens in the URL hash end up in browser history.
  - It also makes U-1 and U-2 trivial to exploit, since the user's JWT is right there.
- **Fix:**
  - Stop returning tokens from `/verify`; return only `{ user: { id, email }, expires_at }`.
  - The frontend only needs the Supabase client for `signInWithOAuth`. Use PKCE (`flowType: 'pkce'`) and exchange the code on the backend, which sets the cookies.
  - Move `updateUser({email})` (RMY-06) to the backend.
  ```diff
  - session: { access_token: token, refresh_token: refreshToken, expires_at: exp * 1000, user: {...} }
  + session: { expires_at: exp * 1000, user: { id: userData.user.id, email: userData.user.email } }
  ```

#### RMY-06 — Email is changed straight from the browser with no re-authentication, and `utenti.email` is never synced · Security/Bug · Medium · High · S-M
- **Where:**
  - `frontend/src/pages/profile.tsx:171` calls `supabase.auth.updateUser({ email })`.
  - No backend code ever updates `utenti.email`. It is written only once, in `lib/utenti.ts:54` and by the DB trigger.
- **What's wrong:**
  - A stolen session (see RMY-05) can move the account to the attacker's email with no password. With email confirmation that is a full **account takeover**, unless "Secure email change" is on (U-4).
  - After a legitimate change, `utenti.email` keeps the old address. Admin verification (`verification.ts:455`), invite alias checks (`onboarding.ts:433`) and `/api/me` then show stale data.
- **Fix:** add `POST /api/me/email`, which asks for the current password, calls `supabaseAdmin.auth.admin.updateUserById` (or the user client) and updates `utenti.email`. Alternatively, sync `utenti.email` from `auth.users` with a trigger on `auth.users` UPDATE. Turn on "Secure email change".

#### RMY-07 — Production source maps are published · Leak · Medium · High · S
- **Where:** `frontend/vite.config.ts:37` `sourcemap: true`. The local `frontend/dist/public/assets/` already holds 48 `.map` files, and Vercel serves them.
- **What's wrong:** anyone can rebuild the full original frontend source, including comments that describe security decisions and internal routes.
- **Fix:**
  ```diff
  -    sourcemap: true,
  +    sourcemap: 'hidden', // maps generated for error tooling, not referenced or served
  ```

#### RMY-08 — No security headers on the frontend pages · Security · Medium · High · S
- **Where:** `frontend/vercel.json` has only `rewrites`. Helmet (`backend/src/app.ts:74-105`) only covers `/api/*` responses. The comment in `frontend/src/lib/supabase.ts:28` assumes the CSP comes from the backend, but it doesn't reach the HTML.
- **What's wrong:**
  - No `frame-ancestors` or `X-Frame-Options`, so the app can be framed (clickjacking on "accept request", "delete listing" or the identity-verification flow).
  - No CSP to limit the impact of any future XSS; Turnstile and gtag are injected with no integrity check.
  - No HSTS on the HTML, no `nosniff`, no `Referrer-Policy`, no `Permissions-Policy`.
  - Verification needs camera and microphone, so it should be the only page allowed to use them.
- **Fix:** add a `headers` block to `vercel.json`:
  ```json
  "headers": [{ "source": "/(.*)", "headers": [
    { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com; connect-src 'self' https://*.supabase.co https://api.geoapify.com https://challenges.cloudflare.com https://www.google-analytics.com; img-src 'self' data: https:; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
    { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" },
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy", "value": "camera=(self), microphone=(self), geolocation=()" }
  ]}]
  ```
  Test the CSP in report-only mode first (`Content-Security-Policy-Report-Only`), since the map tiles (CARTO) and fonts need their origins listed.

#### RMY-09 — Room-photo upload can be used to exhaust server CPU and memory · Security · Medium · High · S
- **Where:**
  - `backend/src/routes/roomly.ts:486-489` has no `photoUploadLimiter`.
  - `:512` runs `reencodeAsJpeg` (sharp, up to 40 MP) **before** the ownership check at `:518-526`.
- **What's wrong:** any logged-in user, whether owner or not, can send unlimited 8 MB, 40-megapixel images to `/api/owner/listings/<any id>/photos`. Each one is fully decoded before the request is rejected with 404. A few parallel loops can saturate the Railway instance.
  - The 10-photo cap is also read-then-insert (`:528-536`), so parallel uploads can go past it.
- **Fix:**
  ```diff
   router.post(
     API_ROUTE_PATHS.OWNER_LISTING_PHOTOS,
     requireAuth,
  +  photoUploadLimiter,
     raw({ type: () => true, limit: ROOM_PHOTO_MAX_SIZE_BYTES }),
  ```
  Move the `stanze` ownership query (`:518-526`) and the count check above `reencodeAsJpeg`. For a hard cap, add a DB check, for example a trigger that counts `stanze_foto` per `stanza_id`.

#### RMY-10 — Personal data in server logs · Privacy/Leak · Medium · High · S
- **Where:**
  - `backend/src/routes/auth.ts:135-138` logs `{ email, authErrorMessage }` on every failed login.
  - Full Supabase error objects go to `console.error` everywhere, for example `lib/utenti.ts:46,63`, `routes/chat.ts:193`, `routes/me.ts:116`, `routes/onboarding.ts:302` and `routes/roomly.ts:*`. Postgres `details` can contain row values such as emails.
  - `routes/waitlist.ts:47` logs the user id.
  - The pino redaction in `lib/logger.ts:7-11` only covers headers, which are already dropped by the serializer, and `console.*` bypasses pino entirely.
- **What's wrong:** Railway logs become a store of personal data with no defined retention (GDPR minimisation and storage limitation), and are readable by anyone with Railway access.
- **Fix:**
  ```diff
  - logger.warn({ email, authErrorCode: …, authErrorMessage: authError?.message }, 'Login failed');
  + logger.warn({ emailHash: crypto.createHash('sha256').update(email).digest('hex').slice(0, 12), authErrorCode: … }, 'Login failed');
  ```
  Replace `console.error(label, error)` with `logger.error({ code: error?.code, msg: error?.message }, label)`. Add `redact: ["*.email", "*.password", "*.access_token", "*.refresh_token", "*.details"]`. Set a log-retention period in Railway.

#### RMY-11 — No password reset flow · Bug · Medium · High · M
- **Where:** there is no `resetPasswordForEmail` call, no `PASSWORD_RECOVERY` handling, no reset page and no "forgot password" link anywhere in `frontend/src` (checked with grep).
- **What's wrong:** an email and password user who forgets the password is locked out for good, or you handle it by hand through support.
- **Fix:** add `POST /api/password/forgot`. It should be rate-limited, require the CAPTCHA, return the same answer whether or not the account exists, and call `resetPasswordForEmail(email, { redirectTo: 'https://www.roomly.group/reset-password' })`. Then add a `/reset-password` page that handles the recovery session and calls `updateUser({ password })` through the backend.

#### RMY-12 — No report, block or moderation tools (scam and harassment risk) · Security/Product · Medium · High · L
- **Where:** there is no report or block route in `backend/src/routes/*`. Admin tools cover only stats and identity verification (`routes/admin.ts`, `routes/verification.ts:445-544`). Messages are free text with no link filtering (`chat.ts:422-453`).
- **What's wrong:** students are young adults sending money for housing, a classic target for rental scams (fake listings, deposit requests, off-platform payment, phishing links).
  - A victim cannot report a listing or a user, or block them.
  - The team cannot hide a listing, suspend a user (see RMY-04) or read a reported conversation without going to the DB.
- **Fix (incremental):**
  1. `POST /api/reports` (target: user, listing or message; reason enum; per-user rate limit) and an admin queue.
  2. `POST /api/conversations/:id/block`, which hides the chat and refuses new messages.
  3. Admin actions: deactivate a listing (`attiva=false`) and suspend a user.
  4. A safety notice in chat when a message contains IBAN, phone, WhatsApp or URL patterns ("Never pay outside Roomly before visiting").

#### RMY-13 — Listing search is unbounded and makes one storage call per result · Bug/Performance · Medium · High · M
- **Where:** `backend/src/routes/roomly.ts:179-219` has no `.range()` or `.limit()`. `:118-123` calls `createSignedUrl` once per listing (`Promise.all`), and `/owner/listings` (`:684-708`) does the same.
- **What's wrong:** response time and Supabase Storage API usage grow linearly with the number of listings. After launch, a search near a big university returns every room within 80 km with N signed-URL round trips, and it is easy to scrape (see RMY-28).
- **Fix:** paginate (`.range(offset, offset + PAGE_SIZE - 1)` plus a `page` query parameter) and sign in one batch:
  ```ts
  const { data } = await supabaseAdmin.storage.from(ROOM_PHOTO_BUCKET).createSignedUrls(paths, ROOM_PHOTO_URL_TTL_SECONDS);
  ```

---

### LOW

#### RMY-14 — Raw technical messages shown to users · Bug/Security · Low · High · S
- **Where:**
  - `backend/src/routes/auth.ts:385` returns `signUpError.message` (raw Supabase text, for example "User already registered" when email confirmation is off, which is account enumeration).
  - `frontend/src/pages/register.tsx:99,110` shows the raw `setSessionError`.
  - `frontend/src/pages/profile.tsx:173` shows the Supabase `error.message`.
  - `frontend/src/pages/login.tsx:65` calls `response.json()` on a non-JSON 502 page, so the user sees "Unexpected token '<'…".
- **Fix:** map known Supabase error codes to translated friendly texts on the server, and fall back to a generic message:
  ```diff
  - return res.status(400).json({ error: signUpError.message });
  + logger.warn({ code: signUpError.code }, 'Signup failed');
  + return res.status(400).json({ error: 'Registrazione non riuscita. Controlla i dati e riprova.', code: signUpError.code === 'weak_password' ? 'weak_password' : 'signup_failed' });
  ```
  Wrap the `response.json()` calls in try/catch.

#### RMY-15 — Consent and age gaps at signup · Privacy · Low · Medium · S
- **Where:**
  - `frontend/src/pages/register.tsx` has no terms or privacy acceptance.
  - The 18+ rule is enforced only when `data_nascita` is set through onboarding (`backend/src/routes/onboarding.ts:67-80,103`).
  - `backend/src/lib/utenti.ts:26,52-60` copies `user_metadata.data_nascita`, `nome` and `cognome` into `utenti` **without validation**. A user who signs up directly against Supabase with `options.data.data_nascita = "2012-01-01"` gets it stored if the backend creates the row before the DB trigger does. Confidence is medium: the live trigger is UNVERIFIED.
  - `data_nascita` and `nazionalita` exist in the schema. Date of birth is justified for the identity check, but check whether `genere` and `nazionalita` are needed at all (data minimisation).
- **Fix:**
  - Add a required "I accept the Terms and Privacy Policy" checkbox and store the timestamp and policy version.
  - Validate metadata in `ensureUtenteRecord` with the same `isAdultBirthDate`, or drop it:
    ```diff
    - const { nome = "", cognome = "", data_nascita = null } = authUser.user.user_metadata ?? {};
    + const { nome = "", cognome = "" } = authUser.user.user_metadata ?? {};
    + const data_nascita = null; // DOB only via onboarding (validated 18+)
    ```

#### RMY-16 — Listing input not fully validated on the server · Bug/Security · Low · High · S
- **Where:**
  - `backend/src/routes/roomly.ts:858-975` (PUT) destructures `req.body` by hand. `address`, `city`, `postcode`, `latitude` and `longitude` are never type-checked, there are no length limits, and price has no upper bound.
  - `CreateListingBody` (`backend/local-libs/api-zod/src/generated/api.ts:75-91`) has no `max` on `title`, `description`, `address` or `city`.
  - The PUT path also doesn't re-check `utenti.owner`.
- **What's wrong:** an over-long title or city (DB `varchar(200)` and `varchar(50)`), or a price ≥ 10⁸, becomes a 500 error instead of a friendly 400. Descriptions can reach the 100 kB body limit. A string latitude is coerced inconsistently.
- **Fix:** reuse one zod schema for POST and PUT, with `title.max(200)`, `description.max(5000)`, `address.max(255)`, `city.max(50)`, `postcode.regex(/^\d{5}$/)`, `price.max(20000)`, and lat/lng as numbers in range.

#### RMY-17 — Contracts return the raw storage path as the student photo URL · Bug/Leak · Low · High · S
- **Where:** `backend/src/routes/contracts.ts:133` sets `studentPhotoUrl: row.studente?.foto_profilo`, which is `<user-uuid>/<uuid>.jpg`, not a URL. Used as `<img src>` in `frontend/src/pages/owner-contracts.tsx:180,432`.
- **What's wrong:** the image is always broken, and the student's internal UUID is exposed.
- **Fix:**
  ```diff
  - studentPhotoUrl: row.studente?.foto_profilo ?? null,
  + studentPhotoUrl: await signedProfilePhotoUrl(row.studente?.foto_profilo),
  ```
  This makes `toContract` async.

#### RMY-18 — A student can never request the same room again after a cancel or reject · Bug · Low · High · S
- **Where:** `backend/src/routes/chat.ts:277-289` returns the existing conversation for `(stanza_id, studente_id)` (unique index from history `004_chat_hardening.sql`), even when it is `annullata` or `rifiutata`. Messaging then returns 409 "Chat is closed" (`:444-446`). Only `annullata` chats can be deleted (`:644`).
- **Fix:** if the existing chat is `annullata`, reopen it (`stato_richiesta = 'in_attesa'`, subject to the same availability and limit checks) and post the new message. Decide on a product rule for `rifiutata`, for example a cool-down.

#### RMY-19 — Untrusted video processed by an older FFmpeg without input hardening · Security · Low · Medium · S
- **Where:** `backend/src/lib/video.ts:56-70`. `ffmpeg-static 5.2.0` ships FFmpeg 6.0. The code uses `-i input` with no `-f`, no `-protocol_whitelist`, and no server-side duration check (`VERIFICATION_VIDEO_MAX_SECONDS` is unused). Up to 30 MB × 10 uploads per minute per user are held in memory (`verification.ts:344`).
- **Note:** there is **no command injection**: `spawn` without a shell, fixed arguments, UUID file names.
- **Fix:**
  ```diff
  -      "-i", input,
  +      "-protocol_whitelist", "file", "-f", INPUT_FORMATS[extension], "-i", input,
  ```
  Also check the duration with ffprobe, and use a separate, tighter limiter for video.

#### RMY-20 — CSRF relies on SameSite=Lax only; no global error handler · Security · Low · Medium · S
- **Where:**
  - The CSRF header is checked only on `/refresh` and `/session` (`routes/auth.ts:174-178,430-435`).
  - Every other state-changing route, including logout, relies on `sameSite: 'lax'` cookies (`auth.ts:45,62`).
  - CORS rejections throw (`app.ts:68`) and there is no error handler, so Express answers 500 (with a stack trace if `NODE_ENV` isn't production).
- **Fix:** add a small middleware that requires `X-CSRF-Token === req.cookies['csrf-token']` on all non-GET `/api` routes (except login and register), and send the header from `custom-fetch.ts`. Add a final error handler: `app.use((err, req, res, _next) => { logger.error({ msg: err.message }); res.status(err.message?.startsWith('Origin not allowed') ? 403 : 500).json({ error: 'Internal server error' }); })`.

#### RMY-21 — Read-then-write races · Bug · Low · High · S-M
- **Where:**
  - Photo count (`roomly.ts:528-536`).
  - Pending requests per room (`chat.ts:302-310`).
  - `posizione = MAX + 1` (`lib/utenti.ts:28-35`), which gives duplicate waitlist positions on concurrent signups.
  - Invite claim plus onboarding.
- **Note:** request acceptance itself is safe: conditional updates in `transitionPending` and `stanze.stato`, plus the unique index `conversazioni_stanza_accettata_uniq`.
- **Fix:** enforce the limits in the DB (constraint or trigger), or use a single `INSERT … SELECT … WHERE (SELECT count(*) …) < N`.

#### RMY-22 — Old test script with credentials in git history · Leak · Low · High · S
- **Where:** commit `0e72ff7`, `test.py:7-8,30` (deleted in `2ea8c82`). It contains the Supabase project URL (`http***`), the publishable key (`sb_p***`) and a hardcoded test-account password (`Test***`).
- **What's wrong:** the publishable key is public by design. The **test account password** works for anyone who reads the history if the repo is ever made public or shared.
- **Fix:** change or delete that test account in Supabase. Rewriting history is optional.

#### RMY-23 — Logout leftovers · Bug/Security · Low · High · S
- **Where:**
  - `frontend/src/components/layout/profile-menu.tsx:73-81` has no try/catch: if `/api/logout` fails, `signOut` and the cache clearing never run.
  - The React Query cache (`App.tsx:17`) is not cleared, so the previous user's data stays in memory.
  - `roomly.account` (name, email, photo URL) is stored in localStorage (`lib/account-cache.ts:86`).
  - On the backend, a revoked token stays accepted for up to 60 s through `tokenCache` (`middleware/auth.ts:12,51-58`).
- **Fix:** wrap the logout in try/finally, call `queryClient.clear()`, and delete the token from `tokenCache` on `/logout`.

#### RMY-24 — Frontend crash and leak risks · Bug · Low · High · S
- `frontend/src/components/shared/listing-map.tsx:87,119`: `CATEGORIES.find(...)!` throws if the backend adds a new place category, crashing the listing page.
- `frontend/src/pages/messages.tsx:538`: unhandled `navigator.clipboard.writeText` rejection.
- `messages.tsx:540`: `setTimeout` never cleared.
- `messages.tsx:379-381`: delete errors swallowed with no message to the user.
- `frontend/src/pages/home.tsx:60-89`: async effect without a cancel flag can navigate after unmount.
- Loose `any`: `register.tsx:76`, `new-listing.tsx:108,278,280`, `edit-listing.tsx:145`, `AddressAutocomplete.tsx:23,49,65,86`, `backend/src/routes/roomly.ts:931`.
- **Fix:** guard `find()` with a fallback icon, add `.catch()`, and clean up timers in effects.

#### RMY-25 — No CI, no lint, no tests while every push deploys to production · Bug/Process · Low · High · M
- **Where:** there is no `.github/workflows`, and no `lint` or `test` scripts in `backend/package.json` or `frontend/package.json`. Vercel previews also proxy `/api` to the **production** backend (`vercel.json:3`).
- **Fix:** add a GitHub Action on pull requests and `main` running `npm ci && npm run typecheck && npm audit --audit-level=high` for both packages, and turn on branch protection so `main` needs it to pass. Point previews at a staging backend.

---

### INFO

#### RMY-26 — Client-side role guards trust localStorage · Info · High · S
`RequireAdmin.tsx:18-23`, `RequireOwner.tsx:11-13` and `RequireAuth.tsx:23,30` render protected screens from the cached `roomly.lastKnownRole`. Editing localStorage shows the admin page shell. **The data is still protected:** every `/api/admin/*` route runs `requireAdmin` on the server (`middleware/auth.ts:77-94`). Keep it that way. Optionally, render nothing until `/api/me/role` answers.

#### RMY-27 — Deployment hygiene · Info · High · S
- The Railway origin is public in `vercel.json:3`, which enables RMY-01.
- The Vite dev server binds `0.0.0.0` (`frontend/package.json`, `vite.config.ts:14`), exposing the dev build on your local network.
- `react`/`react-dom` are pinned exactly to `19.1.0`, so no patch updates.
- helmet is 7.x (8.x is current).
- Backend production runs `tsx src/index.ts`, compiling TypeScript at runtime.

#### RMY-28 — Minor abuse surfaces · Info · Medium · S
- `GET /dashboard/owner` returns hard-coded zeros (`roomly.ts:663-676`).
- Invite codes are only 8 hex characters and `/me/invito/usa` has no rate limit (`onboarding.ts:419-449`), so codes can be probed. No PII leaks, but the waitlist can be gamed with fake accounts.
- `zone` is passed to `.ilike('%…%')` without escaping `%` and `_` or limiting length (`roomly.ts:189`). This is not an injection: supabase-js encodes the value.
- Listing IDs and conversation IDs are sequential `bigint`. Access to conversations is checked, but listings are easy to enumerate once the pre-launch gate (`requireAppAccess`) is removed.

**Dependencies:** `npm audit` found **0 vulnerabilities** in `backend/` and `frontend/`. No suspicious or typosquatted packages. The project's own package.json files have no `postinstall`. Install scripts come from `esbuild` and `ffmpeg-static` (it downloads a binary at install time).
**Typecheck:** `tsc --noEmit` passes in both `backend/` and `frontend/`. No lint or test suite exists to run.

---

## 3. Fix order (checklist)

**Today (quick wins, S effort)**
- [ ] Run the SQL checks in §5 for **U-1** and **U-2**. If anything is open, lock `utenti`, `preferenze_utenti`, `stanze_foto` and `messages` (RLS on plus REVOKE), and revoke EXECUTE from `PUBLIC` on `libera_stanza` and the other request functions.
- [ ] Check the bucket privacy and policies (**U-3**) and the Auth settings (**U-4**): CAPTCHA on, email confirmation on, secure email change on, leaked-password protection on.
- [ ] **RMY-07:** `sourcemap: 'hidden'`.
- [ ] **RMY-09:** add `photoUploadLimiter` to the room-photo upload and move the ownership check before sharp.
- [ ] **RMY-01:** fix `trust proxy`, add a per-email login limiter, rate-limit `/verify`.
- [ ] **RMY-08:** add security headers in `vercel.json` (start in report-only).
- [ ] **RMY-22:** change the test-account password.
- [ ] **RMY-17:** sign `studentPhotoUrl`.

**This week (M)**
- [ ] **RMY-05:** stop returning tokens from `/verify`; switch OAuth to PKCE with a backend code exchange.
- [ ] **RMY-06:** move the email change to the backend, require the password, sync `utenti.email`.
- [ ] **RMY-04:** enforce `utenti.stato` in `requireAuth`.
- [ ] **RMY-10:** remove email and error objects from logs, add redaction and log retention.
- [ ] **RMY-14, RMY-16:** friendly errors, shared zod schema with limits.
- [ ] **RMY-11:** password reset flow.
- [ ] **RMY-25:** CI with typecheck and audit, plus branch protection.

**Before public launch (L)**
- [ ] **RMY-02:** account deletion and data export, with storage cleanup.
- [ ] **RMY-03:** retention limit and DPIA for verification files; consent off by default; privacy-policy text.
- [ ] **RMY-12:** report, block and moderation tools; scam warnings in chat.
- [ ] **RMY-13:** paginate search, batch-sign URLs.
- [ ] **RMY-15, RMY-18 to RMY-21, RMY-23, RMY-24:** remaining Low items.

---

## 4. Things done well

- **Server-side authorisation everywhere.** Every ID taken from the client is scoped by `proprietario_id`, membership or `studente_id` in the query itself. Other users' chats return 404, so their existence isn't revealed (`chat.ts:143-166, 469-482`, `roomly.ts:518-526, 591-599, 893-898`, `contracts.ts:341, 432-438`).
- **No mass assignment.** Insert and update objects are built field by field. `proprietario_id`, `mittente_id`, `studente_id`, `tipo` and `stato_richiesta` always come from the server, and `tipo = 'sistema'` can only be produced by the server. The onboarding schema is `.strict()`.
- **Request state machine is atomic.** Conditional `UPDATE … WHERE stato_richiesta = 'in_attesa'`, room take-over guarded by `stato = 'disponibile'` with rollback, and a DB unique index on one accepted request per room. Owner-only accept and reject, student-only cancel.
- **The JWT is verified on the server** (`auth.getUser`, not just decoded). Admin is re-checked on every admin call. Reviewers can't decide their own verification.
- **Upload pipeline:** the server builds UUID paths; magic-byte checks; sharp re-encode strips EXIF/GPS and kills polyglots; SVG and HTML rejected; private buckets with short-lived signed URLs; ffmpeg spawned without a shell.
- **Privacy details:** public coordinates rounded to about 100 m (`roomly.ts:150-152, 328-330`); the exact address is never returned on the listing page; Google Analytics only after opt-in consent, with IP and ad features off; CSV export neutralises formulas.
- **Secrets:** the service-role key is server-only, there is no secret in the tree or the history (only a publishable key and a test password, RMY-22), and `.env*` is gitignored.
- **CORS:** exact-match allowlist with credentials; `x-powered-by` off; helmet configured.
- **No XSS sinks** in the frontend (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, Leaflet HTML popups); React escapes all user text. No open redirects.
- `npm audit` is clean and `tsc` passes in both packages.

---

## 5. Manual checks for me

Run the SQL in **Supabase → SQL Editor** (read-only queries).

### 5.1 RLS on every table → U-1, RMY-05
```sql
select c.relname, c.relrowsecurity as rls_on
from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by 1;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated') order by 1, 2;
```
**Expected:** `rls_on = true` for every table. No policies, or only SELECT policies that don't expose personal columns, for `anon` and `authenticated`. **No UPDATE or INSERT policy on `utenti`.**

**Live test:** sign in as a normal user, copy the `access_token` from the `/api/verify` response in DevTools → Network, then:
```bash
curl -X PATCH "$SUPABASE_URL/rest/v1/utenti?id=eq.<your uuid>" \
  -H "apikey: <publishable key>" -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"admin":true}'
```
Expected: 401/403, or `[]`. Also try `GET /rest/v1/utenti?select=email,telefono` with only the apikey. It must return 401 or `[]`.

### 5.2 Function grants → U-2
```sql
select p.proname, p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_can
from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1;

select pg_get_functiondef('public.libera_stanza(bigint,uuid)'::regprocedure);
```
**Expected:** `anon_can = false` and `auth_can = false` for `libera_stanza`, `accetta_richiesta`, `rifiuta_richiesta`, `annulla_richiesta`, `posizione_in_lista`, `handle_email_confirmed` and any other `SECURITY DEFINER` function. Then commit the `libera_stanza` definition to `backend/migrations/`.

### 5.3 Triggers and columns → U-1, U-6, RMY-15
```sql
select tgname, tgrelid::regclass, pg_get_triggerdef(oid) from pg_trigger where not tgisinternal;
select pg_get_functiondef('public.handle_email_confirmed()'::regprocedure);
select column_name, is_identity, identity_generation, column_default
from information_schema.columns where table_schema = 'public' and table_name = 'utenti' and column_name = 'posizione';
```
**Expected:**
- `protect_utenti_owner_flag` exists. Consider extending it to `admin`, `stato`, `email_verificata` and `tipo_utente`.
- `posizione` is **not** `ALWAYS` identity, otherwise `ensureUtenteRecord` is broken.
- `handle_email_confirmed` doesn't copy `data_nascita` from metadata.

### 5.4 Storage → U-3, RMY-03, RMY-09
- **Dashboard → Storage →** each of `foto_stanze`, `foto_profilo` and `verifiche_identita`: **Public = off**, a file size limit is set, and the allowed MIME types are `image/jpeg` (+ `image/png` for profile, + `video/*` for verification).
- ```sql
  select id, public, file_size_limit, allowed_mime_types from storage.buckets;
  select policyname, cmd, roles, qual from pg_policies where schemaname = 'storage';
  ```
  **Expected:** no policy granting `anon` or `authenticated` access to these buckets.
- Check whether old public URLs (`/storage/v1/object/public/foto_stanze/...`) still return images. They must not.

### 5.5 Auth settings → U-4, RMY-01, RMY-06, RMY-11, RMY-14
- **Authentication → Attack Protection:**
  - CAPTCHA **enabled**, with the Turnstile secret set.
  - **Leaked-password protection on.**
- **Authentication → Providers → Email:**
  - Confirm email **on**.
  - **Secure email change on** (both addresses confirm).
  - Minimum password length ≥ 8 with the required characters (match `register.tsx:21`).
- **Authentication → URL Configuration:**
  - Site URL `https://www.roomly.group`.
  - The Redirect URLs allowlist contains **only** `https://www.roomly.group/onboarding` (plus localhost for dev). No wildcards like `https://*.vercel.app/**`.
- **Authentication → Rate Limits:**
  - Review sign-in, sign-up and token-refresh limits.
  - Note that all logins come from the **Railway IP**, so a per-IP Supabase limit can lock out everyone at once. Consider forwarding the client IP, or raising the limit and relying on the backend limiter after fixing RMY-01.
- **Providers → Google:**
  - Authorised redirect URI is the Supabase callback only.
  - Decide the policy for linking a Google account to an existing email and password account with the same email. Supabase links automatically on verified emails, so make sure email confirmation is on.
- **JWT expiry:** keep the access token at 1 h or less. Consider refresh token rotation and reuse detection (on).

### 5.6 Railway → RMY-01, U-5, RMY-10
- `NODE_ENV=production` is set.
- Add `TRUST_PROXY_HOPS` after the fix. To verify, temporarily log `req.ips` on one request through `www.roomly.group` and one direct to `*.up.railway.app`.
- Can direct public access to the Railway domain be turned off, keeping only the custom domain or the Vercel proxy?
- Set log retention. Check who has project access and remove ex-members. Make sure `SUPABASE_SECRET_KEY` is set only on the backend service.

### 5.7 Vercel → RMY-07, RMY-08, RMY-25
- **Project → Settings → Environment Variables:** only `VITE_*` public values, no secret or service key.
- After the fixes, check the response headers of `https://www.roomly.group/` (DevTools → Network). They should include CSP, HSTS, `X-Frame-Options`/`frame-ancestors`, and `nosniff`.
- Confirm `https://www.roomly.group/assets/*.js.map` returns 404 after the sourcemap change.
- Deployment Protection for previews, and preview deployments pointing to a non-production backend.

### 5.8 GitHub → RMY-22, RMY-25
- **Settings → Branches:** protect `main` (require a PR and passing checks; no force-push).
- **Settings → Code security:** enable **Secret scanning** and **Push protection**, and Dependabot alerts.
- Check collaborators and deploy keys.

### 5.9 Third-party keys → U-7
- Geoapify and CARTO: restrict the browser keys to the `https://www.roomly.group` referrer. Use a separate, IP-restricted or unrestricted server key for `GEOAPIFY_API_KEY` on Railway.
- Google Analytics property `G-W2FXJDH258`: IP anonymisation and data retention set to the minimum. Signals off.

### 5.10 Legal → RMY-02, RMY-03, RMY-15
- The privacy policy (`frontend/src/lib/legal-content.ts`) lists all processors: Supabase, Vercel, Railway, Cloudflare Turnstile, Google Analytics, Geoapify, CARTO, Overpass/OSM, Google OAuth. It also states retention periods (messages, logs, verification files) and the legal basis for biometric processing.
- A DPIA for identity verification, and records of processing (Art. 30).

---

## 6. Assumptions and open questions

1. **Deployment topology:** the browser reaches the backend only through the Vercel rewrite; the Railway domain is also publicly reachable (it is listed in `vercel.json`). If Railway is private, RMY-01 drops to Medium.
2. **Railway's `X-Forwarded-For` behaviour:** I assumed Railway's edge appends the real IP to a client-supplied header (standard proxy behaviour). Confirm with the `req.ips` test in §5.6.
3. **Schema source:** `claude_workspace/database.sql` was taken as close to production, but the comments in `lib/utenti.ts` disagree with it (U-6). The live definitions of `libera_stanza`, `handle_email_confirmed`, `prevent_untrusted_room_status_change` and every RLS policy were not visible.
4. **Legacy table `messages`:** migration `004_chat_hardening.sql` (history) enables RLS on it and revokes all. It is unused by code. Should it be dropped?
5. **Pre-launch gate:** listings and starting chats are limited to admins and owners (`requireAppAccess`). Several findings (RMY-12, RMY-13, RMY-28) grow in impact when that gate opens for students.
6. **Product questions:**
   - Should students be able to re-request a room after cancelling (RMY-18)?
   - Is `nazionalita` or `genere` needed at all (RMY-15)?
   - What is the intended retention for training data (RMY-03)?
   - Who may suspend users, and how (RMY-04, RMY-12)?
7. **Out of scope:** dynamic testing, the Supabase dashboard, Vercel and Railway settings, and the `.claude/`, `.agents/` and `.impeccable/` tooling folders were not audited.
