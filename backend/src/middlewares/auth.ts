import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";

export type AuthenticatedRequest = Request & {
  userId: string;
  userEmail: string | undefined;
};

// Verifies the Supabase access token sent by the frontend as
// `Authorization: Bearer <token>` and resolves it to a real, currently
// valid Supabase user. Every route that needs to know "who is calling"
// (including the admin role check) sits behind this middleware, so a
// client can never simply claim a user id.
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
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

  next();
}