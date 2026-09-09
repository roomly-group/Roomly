import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { supabaseAuthClient } from "../lib/supabase-auth.js";

const router: IRouter = Router();

const isProd = process.env.NODE_ENV === "production";

// Helper to set the access-token cookie
function setAuthCookie(res: Response, token: string, options: { httpOnly?: boolean; secure?: boolean; sameSite?: 'Strict' | 'Lax' | 'None'; maxAge?: number } = {}) {
  const defaults = {
    httpOnly: true,
    secure: isProd, // true in production, false in dev
    sameSite: 'Strict' as const,
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  };
  const opts = { ...defaults, ...options };
  res.cookie('sb-token', token, opts);
}

// Helper to set the refresh-token cookie. Without this, the frontend never
// receives a refresh_token from the backend, so supabase.auth.setSession()
// (which requires BOTH tokens) silently fails after every reload — no
// exception is thrown, the client just ends up with no session, which broke
// email display and access to /profile.
function setRefreshCookie(res: Response, refreshToken: string, options: { maxAge?: number } = {}) {
  const defaults = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Strict' as const,
    maxAge: 60 * 60 * 24 * 30, // refresh tokens live longer than access tokens
    path: '/',
  };
  const opts = { ...defaults, ...options };
  res.cookie('sb-refresh-token', refreshToken, opts);
}

function clearAuthCookies(res: Response) {
  const base = { path: '/', httpOnly: true, secure: isProd, sameSite: 'Strict' as const };
  res.clearCookie('sb-token', base);
  res.clearCookie('sb-refresh-token', base);
}

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    // IMPORTANT: use supabaseAuthClient (anon key), never supabaseAdmin, here.
    // signInWithPassword() sets a live session on whichever client instance
    // calls it — doing that on supabaseAdmin (shared, service-role, used to
    // bypass RLS everywhere else) would silently switch it to run as this
    // user for every later query, server-wide, until the next login.
    const { data: authData, error: authError } = await supabaseAuthClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { access_token, refresh_token, user, expires_at } = authData.session;

    // Set HTTP-only cookies with the access token and refresh token
    setAuthCookie(res, access_token, {
      // Set cookie expiry to match Supabase session expiry
      maxAge: Math.floor((new Date(expires_at * 1000).getTime() - Date.now()) / 1000),
    });
    setRefreshCookie(res, refresh_token);

    // Return session data for frontend to set Supabase client session
    // Note: This is only used temporarily to set supabase.auth.setSession()
    // and is not stored persistently by frontend code
    res.json({
      session: {
        access_token,
        refresh_token,
        expires_at,
        user: {
          id: user.id,
          email: user.email,
          // Return other non-sensitive user fields as needed
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh endpoint - called to get a new cookie pair with a genuinely fresh
// access token, using the stored refresh token (real refresh, not just a
// cookie re-set of the same access token as before).
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.['sb-refresh-token'];

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token cookie' });
  }

  try {
    // Same reasoning as /login: refreshSession() would set a session on
    // whichever client calls it. Must not be supabaseAdmin.
    const { data, error } = await supabaseAuthClient.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh token expired or invalid' });
    }

    const { access_token, refresh_token, expires_at, user } = data.session;

    setAuthCookie(res, access_token, {
      maxAge: expires_at ? Math.floor((new Date(expires_at * 1000).getTime() - Date.now()) / 1000) : undefined,
    });
    setRefreshCookie(res, refresh_token);

    res.json({
      session: {
        access_token,
        refresh_token,
        expires_at: expires_at ? expires_at * 1000 : undefined,
        user: { id: user.id, email: user.email },
      },
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify endpoint - checks if cookie is valid and returns session data
router.post('/verify', async (req: Request, res: Response) => {
  const token = req.cookies?.['sb-token'];
  const refreshToken = req.cookies?.['sb-refresh-token'];

  if (!token) {
    return res.status(401).json({ error: 'No token cookie' });
  }

  try {
    // Validate the token with Supabase admin (only gets user data)
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    // Check if userData is valid and contains user information
    if (userError || !userData || typeof userData !== 'object' || !userData.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Decode JWT token to get expiration time
    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) {
        throw new Error('Invalid token format');
      }
      // Replace URL-safe characters and add padding if needed
      const payload = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding to make length multiple of 4
      const paddedPayload = payload.length % 4 === 0 ? payload : payload + '='.repeat(4 - (payload.length % 4));
      const decodedPayload = Buffer.from(paddedPayload, 'base64').toString('utf-8');
      const payloadJson = JSON.parse(decodedPayload);
      const exp = payloadJson.exp;

      if (typeof exp !== 'number') {
        throw new Error('Invalid or missing expiration time in token');
      }

      // Return session data to restore Supabase client session.
      // refresh_token MUST be included, otherwise supabase.auth.setSession()
      // fails silently on the frontend and the client ends up with no session.
      res.json({
        session: {
          access_token: token,
          refresh_token: refreshToken,
          expires_at: exp * 1000, // Convert seconds to milliseconds
          user: {
            id: userData.user.id,
            email: userData.user.email,
            // Add other non-sensitive user fields as needed
          }
        }
      });
    } catch (decodeError) {
      console.error('JWT decode error:', decodeError);
      // If we can't decode the token or extract expiration, still return a session
      // We know the token is valid because getUser succeeded, so we use a reasonable expiration
      // Using 1 hour from now as a fallback - shorter is safer than longer
      const fallbackExp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour from now
      res.json({
        session: {
          access_token: token,
          refresh_token: refreshToken,
          expires_at: fallbackExp * 1000,
          user: {
            id: userData.user.id,
            email: userData.user.email,
            // Add other non-sensitive user fields as needed
          }
        }
      });
    }
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

// Config endpoint - lets frontend know if email confirmation is required
router.get('/config', (_req: Request, res: Response) => {
  res.json({ requireEmailConfirmation: true });
});

// Register endpoint - registration must be done via frontend's supabase.auth.signUp()
// to ensure email confirmation flow is respected
router.post('/register', async (_req: Request, res: Response) => {
  res.status(409).json({
    error:
      "Email confirmation is required. Use supabase.auth.signUp() from the frontend instead of this route.",
  });
});

// Idrata i cookie di sessione da un access_token/refresh_token Supabase
// ottenuti lato client (es. subito dopo signUp(), o dopo il redirect di
// conferma email), quando quel flusso non passa da /login.
router.post('/session', async (req: Request, res: Response) => {
  const { access_token, refresh_token } = req.body as { access_token?: string; refresh_token?: string };

  if (!access_token || !refresh_token) {
    return res.status(400).json({ error: 'Missing access_token or refresh_token' });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(access_token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  setAuthCookie(res, access_token);
  setRefreshCookie(res, refresh_token);
  res.json({ ok: true });
});

export default router;
