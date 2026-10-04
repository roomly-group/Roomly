import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";

export type AuthenticatedRequest = Request & {
  userId: string;
  userEmail: string | undefined;
};

// Cache breve token -> utente. Senza questo, ogni richiesta API (anche il
// polling della chat) fa prima un giro di rete verso Supabase (auth.getUser).
// Il token resta valido per la durata della cache anche se viene revocato
// nel frattempo: teniamo il TTL corto.
const TOKEN_CACHE_TTL_MS = 60_000;
const TOKEN_CACHE_MAX = 5_000;
const tokenCache = new Map<string, { userId: string; userEmail: string | undefined; expires: number }>();

function cacheToken(token: string, userId: string, userEmail: string | undefined) {
  if (tokenCache.size >= TOKEN_CACHE_MAX) {
    const now = Date.now();
    for (const [key, entry] of tokenCache) if (entry.expires <= now) tokenCache.delete(key);
    // Ancora pieno (molti token validi): togliamo il più vecchio inserito.
    if (tokenCache.size >= TOKEN_CACHE_MAX) {
      const oldest = tokenCache.keys().next().value;
      if (oldest !== undefined) tokenCache.delete(oldest);
    }
  }
  tokenCache.set(token, { userId, userEmail, expires: Date.now() + TOKEN_CACHE_TTL_MS });
}

// Verifies the Supabase access token sent via HttpOnly cookie and resolves it to a real, currently
// valid Supabase user. Every route that needs to know "who is calling"
// (including the admin role check) sits behind this middleware, so a
// client can never simply claim a user id.
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.['sb-token'];

  if (!token) {
    res.status(401).json({ error: "Missing auth cookie" });
    return;
  }

  const cached = tokenCache.get(token);
  if (cached && cached.expires > Date.now()) {
    const cachedReq = req as AuthenticatedRequest;
    cachedReq.userId = cached.userId;
    cachedReq.userEmail = cached.userEmail;
    next();
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const authedReq = req as AuthenticatedRequest;
  authedReq.userId = data.user.id;
  authedReq.userEmail = data.user.email ?? undefined;
  cacheToken(token, data.user.id, data.user.email ?? undefined);

  next();
}