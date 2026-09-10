import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { type Request, type Response } from 'express';

/**
 * Extracts and normalizes IP address for use in rate limiting keys.
 * Properly handles IPv6 addresses using the ipKeyGenerator helper.
 */
const extractIP = (req: Request): string => {
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || '');
};

/**
 * Rate limiter for login endpoint.
 * Allows 5 requests per 15 minutes per IP and email combination.
 * This prevents brute-force attacks on passwords and also throttles
 * distributed attacks against a single account.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request) => {
    // Use IP and email (if available) as the key
    const ip = extractIP(req);
    const email = req.body?.email?.toLowerCase().trim() || '';
    return `${ip}:${email}`;
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many login attempts, please try again later.',
    });
  },
});

/**
 * Rate limiter for refresh endpoint.
 * Allows 20 requests per 15 minutes per IP.
 * This is more lenient as legitimate clients refresh tokens periodically.
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request) => {
    // Use IP as the key with proper IPv6 handling
    return extractIP(req);
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many token refresh requests, please try again later.',
    });
  },
});