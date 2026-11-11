// Fake Supabase (Auth + a little of PostgREST) for local runtime checks.
// See SKILL.md next to this file. Lets the real backend and frontend run
// without touching the production project.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ===================== CONFIGURATION =====================
const PORT = 54999;
const OUT_DIR = process.env.STUB_DIR || os.tmpdir();
const LOG_FILE = path.join(OUT_DIR, 'requests.log');
const TOKENS_FILE = path.join(OUT_DIR, 'tokens.json');
/** Access-token lifetime: set e.g. STUB_TOKEN_LIFETIME_S=70 to watch the frontend refresh on its own. */
const TOKEN_LIFETIME_S = Number(process.env.STUB_TOKEN_LIFETIME_S) || 3600;
const REFRESH_OLD = 'stub-refresh-OLD';
const PKCE_CODE = 'stub-code';
const RIGHT_PASSWORD = 'right-pass';
const RIGHT_OTP = '123456';
const TAKEN_EMAIL = 'taken@test.local';
const USER_ID = '00000000-0000-4000-8000-000000000123';
const USER_EMAIL = 'student@test.local';

// Unsigned JWT-shaped tokens: the backend only decodes the payload (exp, amr).
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
const jwt = (tag, exp) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: USER_ID, email: USER_EMAIL, role: 'authenticated', aud: 'authenticated', exp, amr: [{ method: 'password', timestamp: now() }], session_id: tag })}.c2ln`;
const ACCESS_OLD = jwt('old', now() + TOKEN_LIFETIME_S);
fs.writeFileSync(TOKENS_FILE, JSON.stringify({ ACCESS_OLD, REFRESH_OLD }));

// Every access token this stub issued is valid for /user; refresh tokens rotate.
const validAccess = new Set([ACCESS_OLD]);
const validRefresh = new Set([REFRESH_OLD]);
let counter = 0;
let lastChallenge = null; // PKCE challenge from the last authorize/signup/email change
let provider = 'email'; // 'email' (has password) or 'google' (no password); POST /__stub/provider?value=google

const user = () => ({ id: USER_ID, aud: 'authenticated', role: 'authenticated', email: USER_EMAIL, app_metadata: { provider, providers: [provider] }, user_metadata: {}, identities: [{ provider, id: 'i-1', user_id: USER_ID }], created_at: '2026-01-01T00:00:00Z' });
function newSession(tag) {
  counter += 1;
  const exp = now() + TOKEN_LIFETIME_S;
  const access = jwt(`${tag}-${counter}`, exp);
  const refresh = `stub-refresh-${tag}-${counter}`;
  validAccess.add(access);
  validRefresh.add(refresh);
  return { access_token: access, refresh_token: refresh, token_type: 'bearer', expires_in: TOKEN_LIFETIME_S, expires_at: exp, user: user() };
}
const utentiRow = { id: USER_ID, nome: 'Stu', cognome: 'Dent', email: USER_EMAIL, posizione: 1, lingua: 'en', data_nascita: '2000-01-01', foto_profilo: null, onboarding_completato_at: '2026-01-01T00:00:00Z', admin: false, owner: false, stato: 'attivo' };
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer /, '');

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    fs.appendFileSync(LOG_FILE, `${req.method} ${req.url} ${body}\n`);
    const send = (status, payload, type = 'application/json', extra = {}) => {
      res.writeHead(status, { 'content-type': type, ...cors, ...extra });
      res.end(status === 204 ? undefined : type === 'application/json' ? JSON.stringify(payload) : payload);
    };
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const json = () => { try { return JSON.parse(body || '{}'); } catch { return {}; } };
    const err = (status, code, msg) => send(status, { code: status, error_code: code, msg });
    const p = url.pathname;

    if (req.method === 'OPTIONS') return send(204, null);
    if (p === '/__stub/provider') { provider = url.searchParams.get('value') || 'email'; return send(200, { provider }); }
    // utenti.stato: 'sospeso' makes password login answer user_banned (tokens already issued stay valid here)
    if (p === '/__stub/stato') { utentiRow.stato = url.searchParams.get('value') || 'attivo'; return send(200, { stato: utentiRow.stato }); }

    // ---------- Auth ----------
    if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
    if (p === '/auth/v1/user' && req.method === 'GET') return validAccess.has(bearer(req)) ? send(200, user()) : err(401, 'bad_jwt', 'invalid JWT');
    if (p === '/auth/v1/user' && req.method === 'PUT') {
      if (!validAccess.has(bearer(req))) return err(401, 'bad_jwt', 'invalid JWT');
      const { email, code_challenge } = json();
      if (email === TAKEN_EMAIL) return err(422, 'email_exists', 'A user with this email address has already been registered');
      lastChallenge = code_challenge ?? null;
      return send(200, { ...user(), new_email: email });
    }
    if (p === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type');
      const b = json();
      if (grant === 'refresh_token') {
        if (!validRefresh.has(b.refresh_token)) return err(400, 'refresh_token_not_found', 'Invalid Refresh Token');
        validRefresh.delete(b.refresh_token);
        return send(200, newSession('refreshed'));
      }
      if (grant === 'password') {
        if (!b.gotrue_meta_security?.captcha_token) return err(400, 'captcha_failed', 'captcha protection: request disallowed');
        if (b.email !== USER_EMAIL || b.password !== RIGHT_PASSWORD || provider !== 'email') return err(400, 'invalid_credentials', 'Invalid login credentials');
        if (utentiRow.stato !== 'attivo') return err(400, 'user_banned', 'User is banned');
        return send(200, newSession('proof'));
      }
      if (grant === 'pkce') {
        const expected = b.code_verifier ? crypto.createHash('sha256').update(b.code_verifier).digest('base64url') : null;
        if (b.auth_code !== PKCE_CODE || !lastChallenge || expected !== lastChallenge) return err(400, 'flow_state_not_found', 'invalid flow state, no valid flow state found');
        lastChallenge = null; // single use
        return send(200, newSession('pkce'));
      }
    }
    if (p === '/auth/v1/signup' && req.method === 'POST') {
      const b = json();
      if (!b.gotrue_meta_security?.captcha_token) return err(400, 'captcha_failed', 'captcha protection: request disallowed');
      lastChallenge = b.code_challenge ?? null;
      return send(200, { ...user(), email: b.email, confirmation_sent_at: new Date().toISOString() });
    }
    if (p === '/auth/v1/otp' && req.method === 'POST') {
      const b = json();
      if (!b.gotrue_meta_security?.captcha_token) return err(400, 'captcha_failed', 'captcha protection: request disallowed');
      return send(200, {});
    }
    if (p === '/auth/v1/verify' && req.method === 'POST') {
      const b = json();
      return b.email === USER_EMAIL && b.token === RIGHT_OTP ? send(200, newSession('otp')) : err(403, 'otp_expired', 'Token has expired or is invalid');
    }
    if (p === '/auth/v1/logout') { validAccess.delete(bearer(req)); return send(204, null); }
    if (p === `/auth/v1/admin/users/${USER_ID}`) return send(200, user());
    if (p === '/auth/v1/authorize') {
      lastChallenge = url.searchParams.get('code_challenge');
      return send(200, `<html><body><h1>STUB AUTHORIZE</h1><pre>${[...url.searchParams.keys()].join('\n')}</pre></body></html>`, 'text/html');
    }

    // ---------- PostgREST (just enough for /api/me and the profile page) ----------
    if (p.startsWith('/rest/v1/')) {
      const single = String(req.headers.accept || '').includes('vnd.pgrst.object');
      if (p === '/rest/v1/utenti') return send(200, single ? utentiRow : [utentiRow], 'application/json', { 'content-range': '0-0/1' });
      return single ? send(406, { code: 'PGRST116', message: 'no rows' }) : send(200, [], 'application/json', { 'content-range': '*/0' });
    }
    send(404, { msg: 'stub: not found' });
  });
}).listen(PORT, '127.0.0.1', () => console.log(`supabase stub on ${PORT}, writing to ${OUT_DIR}`));
