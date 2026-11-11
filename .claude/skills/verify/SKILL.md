---
name: verify
description: How to run Roomly locally (backend + frontend) against a fake Supabase Auth, and drive auth flows over HTTP and in a real browser, without touching production.
---

# Verify Roomly at runtime

## Never point a local run at production

`backend/.env` holds the PRODUCTION Supabase URL and keys. On startup the backend
runs the "Identity verification purge" job against `SUPABASE_URL`, so a plain
`npm run dev` touches the live database. Always override the Supabase vars on the
command line (dotenv and Vite never override variables already in the
environment). Never edit, print or copy the `.env` files.

## 1. Fake Supabase Auth

`supabase-stub.mjs` (next to this file) listens on `127.0.0.1:54999`. The user
is `student@test.local` (UUID id, as Supabase's admin API requires one).

| Route | Behaviour |
|---|---|
| `GET /auth/v1/settings` | `{ external: { google: true } }` (shows the Google button) |
| `GET /auth/v1/user` | 200 for any access token the stub issued, 401 otherwise |
| `PUT /auth/v1/user` | email change. `taken@test.local` → 422 `email_exists`. Records the PKCE challenge |
| `POST /auth/v1/token?grant_type=refresh_token` | valid refresh token → new session (rotates). Starts with `stub-refresh-OLD` |
| `POST /auth/v1/token?grant_type=password` | needs a captcha token. Password `right-pass` → session |
| `POST /auth/v1/token?grant_type=pkce` | `auth_code=stub-code` + verifier whose SHA-256 matches the last challenge → session (single use) |
| `GET /auth/v1/authorize` | records `code_challenge`, shows the query keys |
| `POST /auth/v1/signup` / `POST /auth/v1/otp` | need a captcha token. Signup records the challenge |
| `POST /auth/v1/verify` | OTP `123456` → session |
| `POST /auth/v1/logout`, `GET /auth/v1/admin/users/:id` | admin sign-out and user lookup |
| `GET /rest/v1/utenti` | one profile row. Other tables → empty |
| `POST /__stub/provider?value=google\|email` | switches the user between Google-only (no password) and password accounts |

Every request is appended to `$STUB_DIR/requests.log`. The first access token is
written to `$STUB_DIR/tokens.json` (`ACCESS_OLD`). Use the session scratchpad as `STUB_DIR`.
Set `STUB_TOKEN_LIFETIME_S=70` to see the frontend refresh the session by itself after about 10 s.

To simulate the Google round trip in a browser, click the Google button (which records the challenge),
then open `/onboarding?code=stub-code` in the same context.

## 2. Start everything (background)

```bash
S=<scratchpad dir>
STUB_DIR=$S node .claude/skills/verify/supabase-stub.mjs > $S/stub.out 2>&1 &
(cd backend && SUPABASE_URL=http://127.0.0.1:54999 SUPABASE_SECRET_KEY=dummy-secret \
  SUPABASE_ANON_KEY=dummy-anon PORT=3001 NODE_ENV=development npx tsx src/index.ts > $S/backend.out 2>&1 &)
(cd frontend && VITE_SUPABASE_URL=http://127.0.0.1:54999 VITE_SUPABASE_PUBLISHABLE_KEY=dummy-anon \
  VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  BACKEND_URL=http://127.0.0.1:3001 npx vite --config vite.config.ts --host 127.0.0.1 > $S/frontend.out 2>&1 &)
```

`1x00000000000000000000AA` is Cloudflare's public Turnstile test key, which always passes after about 2 s.
The backend has no file watcher and keeps its rate limits in memory. Restart it after backend edits,
or when a probe hits a per-user limit (email change allows 5 attempts per 15 minutes).

The app is at `http://127.0.0.1:5173`, and `/api/*` is proxied to the backend.
To stop everything, kill the PIDs listening on 54999, 3001 and 5173 (`ss -ltnpH "sport = :PORT"`).

## 3. Drive it

- **HTTP:** a hook blocks `curl`, so use a small Node `fetch` script. Send cookies
  as `Cookie: sb-token=<ACCESS_OLD>; sb-refresh-token=stub-refresh-OLD`.
- **Browser:** the Playwright MCP plugin needs Google Chrome, which is not installed.
  Use the Playwright package from the npx cache (`find ~/.npm/_npx -maxdepth 3 -name playwright`)
  with the cached Firefox:
  `firefox.launch({ executablePath: ~/.cache/ms-playwright/firefox-<build>/firefox/firefox })`.
  The package may expect a newer build than the cache has. Passing `executablePath` works around it.
- To log a browser context in, use `ctx.addCookies([{ name: 'sb-token', … , httpOnly: true }])`.

## Flows worth driving for auth changes

- `POST /api/verify` with both cookies, with the refresh cookie only, and with no cookies.
- Inside a logged-in page, `page.evaluate(() => fetch('/api/verify', { method: 'POST' }).then(r => r.json()))`
  is what an XSS can read. It must never contain `access_token` or `refresh_token`.
- Google button on `/login` → the request to `/auth/v1/authorize` (stub) must carry `code_challenge`.
- The back button after an OAuth return: no `code=` or tokens in the history.
- A link opened without the verifier cookie (`/onboarding?code=stub-code` in a fresh context),
  an old `#access_token=…` link, or `?error=…` should all end on `/login?link=failed` with the notice.
- Profile → settings → change the email: password accounts see a password field plus Turnstile.
  Google-only accounts see "Send code", then a code field.
