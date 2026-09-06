import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import cookie from "cookie";

const router: IRouter = Router();

// Helper to set secure cookie
function setAuthCookie(res: Response, token: string, options: { httpOnly?: boolean; secure?: boolean; sameSite?: 'Strict' | 'Lax' | 'None'; maxAge?: number } = {}) {
  const defaults = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // true in production, false in dev
    sameSite: 'Strict' as const,
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  };
  const opts = { ...defaults, ...options };
  res.cookie('sb-token', token, opts);
}

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    // Verify credentials with Supabase using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { access_token, user, expires_at } = authData.session;

    // Set HTTP-only cookie with the access token
    setAuthCookie(res, access_token, {
      // Set cookie expiry to match Supabase session expiry
      maxAge: Math.floor((new Date(expires_at * 1000) - Date.now()) / 1000)
    });

    // Return session data for frontend to set Supabase client session
    // Note: This is only used temporarily to set supabase.auth.setSession()
    // and is not stored persistently by frontend code
    res.json({
      session: {
        access_token,
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

// Refresh endpoint - called to get a new cookie with fresh token
router.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.['sb-token'];

  if (!token) {
    return res.status(401).json({ error: 'No token cookie' });
  }

  try {
    // Validate the token with Supabase admin
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      // Token is invalid/expired
      res.clearCookie('sb-token', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: 'Strict'
      });
      return res.status(401).json({ error: 'Token expired or invalid' });
    }

    // Token is still valid - we'll refresh it by getting a fresh session
    // Note: Supabase admin client doesn't auto-refresh tokens, but we can
    // get the user and then create a new session if needed
    // For now, we'll just extend the existing token's life by setting a new cookie
    // with the same token (this maintains security but doesn't actually refresh)
    // A more sophisticated approach would involve storing refresh tokens server-side
    const freshToken = token; // In a production app, you'd actually refresh here

    // Set new cookie with same token (extends expiration)
    setAuthCookie(res, freshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify endpoint - checks if cookie is valid and returns session data
router.post('/verify', async (req: Request, res: Response) => {
  const token = req.cookies?.['sb-token'];

  if (!token) {
    return res.status(401).json({ error: 'No token cookie' });
  }

  try {
    // Validate the token with Supabase admin
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user || !data.session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Return session data to restore Supabase client session
    res.json({
      session: {
        access_token: data.session.access_token,
        expires_at: data.session.expires_at,
        user: {
          id: data.user.id,
          email: data.user.email,
          // Add other non-sensitive user fields as needed
        }
      }
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('sb-token', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: 'Strict'
  });
  res.json({ ok: true });
});

export default router;