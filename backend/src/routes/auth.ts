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
    // Validate the token with Supabase admin (only gets user data)
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
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

      // Return session data to restore Supabase client session
      res.json({
        session: {
          access_token: token,
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
  res.clearCookie('sb-token', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: 'Strict'
  });
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

export default router;