import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { type Request, type Response } from 'express';

// ===================== CONFIGURATION =====================

/** Login limiter window shared by the login and refresh endpoints (ms). */
const RATE_LIMIT_WINDOW_15_MINUTES_MS = 900000 as const;
/** Signup limiter window (ms). */
const SIGNUP_RATE_LIMIT_WINDOW_MS = 3600000 as const;
/** Message and chat-read limiter windows (ms). */
const CHAT_RATE_LIMIT_WINDOW_MS = 60000 as const;
/** Maximum login attempts allowed per window. */
const LOGIN_RATE_LIMIT_MAX_REQUESTS = 10 as const;
/** Maximum signups allowed per window. */
const SIGNUP_RATE_LIMIT_MAX_REQUESTS = 5 as const;
/** Maximum token refresh requests allowed per window. */
const REFRESH_RATE_LIMIT_MAX_REQUESTS = 20 as const;
/** Maximum messages allowed per window. */
const MESSAGE_RATE_LIMIT_MAX_REQUESTS = 30 as const;
/** Maximum chat-read requests allowed per window. */
const CHAT_READ_RATE_LIMIT_MAX_REQUESTS = 120 as const;
/** Maximum WRONG-PASSWORD logins allowed per email address per window, from any IP. */
const LOGIN_EMAIL_RATE_LIMIT_MAX_FAILURES = 10 as const;
/** Maximum session-check (/verify) requests allowed per IP per window. */
const VERIFY_RATE_LIMIT_MAX_REQUESTS = 120 as const;
/**
 * Status code the login route returns ONLY when Supabase checked the password
 * and refused it. CAPTCHA failures and missing fields use other codes, so they
 * never count toward the per-email limit (see loginEmailLimiter).
 */
const LOGIN_WRONG_PASSWORD_STATUS = 401 as const;

/**
 * Extracts and normalizes IP address for use in rate limiting keys.
 * Properly handles IPv6 addresses using the ipKeyGenerator helper.
 * req.ip is the visitor IP written by Vercel (see TRUST_PROXY_SETTING in app.ts).
 */
const extractIP = (req: Request): string => {
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || '');
};

/** Normalizes the login email the same way routes/auth.ts does (trim + lowercase). */
const normalizeLoginEmail = (req: Request): string => {
  const email = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

/**
 * Rate limiter for login endpoint.
 * Allows LOGIN_RATE_LIMIT_MAX_REQUESTS requests per 15 minutes per IP and
 * email combination. This prevents brute-force attacks on passwords from one
 * IP. Attacks spread over many IPs are stopped by loginEmailLimiter below.
 */
export const loginLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_15_MINUTES_MS, // 15 minutes
  max: LOGIN_RATE_LIMIT_MAX_REQUESTS, // limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request) => {
    // Use IP and email (if available) as the key
    const ip = extractIP(req);
    const email = normalizeLoginEmail(req);
    return `${ip}:${email}`;
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many login attempts, please try again later.',
    });
  },
});

/**
 * Per-account login limiter: LOGIN_EMAIL_RATE_LIMIT_MAX_FAILURES wrong
 * passwords per 15 minutes per email, whatever IP they come from. Stops
 * credential stuffing / brute force spread across many IPs or proxies.
 *
 * Only real wrong-password answers (401) count. Requests with a missing or
 * invalid CAPTCHA get a 400 and are not counted, so nobody can lock a
 * student out of their account just by spamming their email: every counted
 * attempt needs a solved CAPTCHA. Successful logins and blocked (429)
 * requests are not counted either.
 */
export const loginEmailLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_15_MINUTES_MS, // 15 minutes
  max: LOGIN_EMAIL_RATE_LIMIT_MAX_FAILURES,
  standardHeaders: true,
  legacyHeaders: false,
  // No email in the body: the route answers 400 anyway, nothing to count.
  skip: (req: Request) => normalizeLoginEmail(req) === '',
  keyGenerator: (req: Request) => `login-email:${normalizeLoginEmail(req)}`,
  // Count a request only when the password was actually checked and refused.
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req: Request, res: Response) => res.statusCode !== LOGIN_WRONG_PASSWORD_STATUS,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many login attempts, please try again later.',
    });
  },
});

/**
 * Rate limiter for the session check (/verify).
 * Allows VERIFY_RATE_LIMIT_MAX_REQUESTS requests per 15 minutes per IP.
 * The frontend calls it once per full page load and after login/register;
 * the limit is generous because many students can share one campus Wi-Fi IP,
 * but it stops scripts from hammering Supabase through this endpoint.
 */
export const verifyLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_15_MINUTES_MS, // 15 minutes
  max: VERIFY_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => extractIP(req),
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
    });
  },
});

/**
 * Rate limiter for the registration endpoint.
 * Allows 5 signups per hour per IP.
 * Account creation has no "wrong password" signal to throttle on like
 * login does, so scripted mass sign-ups (e.g. hitting this endpoint in a
 * loop with randomized emails) are the main risk here. 5/hour is generous
 * for a real user filling out the form by hand, but throttles scripted abuse.
 */
export const signupLimiter = rateLimit({
  windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS, // 1 hour
  max: SIGNUP_RATE_LIMIT_MAX_REQUESTS, // limit each IP to 5 signups per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => extractIP(req),
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many accounts created from this IP, please try again later.',
    });
  },
});

/**
 * Rate limiter for refresh endpoint.
 * Allows 20 requests per 15 minutes per IP.
 * This is more lenient as legitimate clients refresh tokens periodically.
 */
export const refreshLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_15_MINUTES_MS, // 15 minutes
  max: REFRESH_RATE_LIMIT_MAX_REQUESTS, // limit each IP to 20 requests per windowMs
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

/**
 * Rate limiter for chat messages (start conversation + send message).
 * Allows 30 messages per minute per authenticated user (falls back to IP).
 * Must be mounted after `requireAuth` so `userId` is available.
 */
export const messageLimiter = rateLimit({
  windowMs: CHAT_RATE_LIMIT_WINDOW_MS, // 1 minute
  max: MESSAGE_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req as Request & { userId?: string }).userId;
    return userId ? `user:${userId}` : extractIP(req);
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many messages, please slow down.',
    });
  },
});


/**
 * Rate limiter for chat READS (inbox + message list, incl. the polling).
 * Allows 120 requests per minute per authenticated user (falls back to IP).
 * Normal use is ~15/min per open chat + ~6/min for the inbox; 120/min leaves
 * room for a few tabs but stops someone hammering reload to load the database.
 * Must be mounted after `requireAuth` so `userId` is available.
 */
export const chatReadLimiter = rateLimit({
  windowMs: CHAT_RATE_LIMIT_WINDOW_MS, // 1 minute
  max: CHAT_READ_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req as Request & { userId?: string }).userId;
    return userId ? `chat-read:${userId}` : extractIP(req);
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests, please slow down.',
    });
  },
});

/** Profile-photo uploads allowed per user per window (uploads). */
const PHOTO_UPLOAD_RATE_LIMIT_MAX_REQUESTS = 10 as const;

/**
 * Rate limiter for profile-photo uploads (up to 5 MB each): stops one account
 * from hammering storage and bandwidth. Keyed by user; mount after requireAuth.
 */
export const photoUploadLimiter = rateLimit({
  windowMs: CHAT_RATE_LIMIT_WINDOW_MS, // 1 minute
  max: PHOTO_UPLOAD_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req as Request & { userId?: string }).userId;
    return userId ? `photo:${userId}` : extractIP(req);
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: 'Troppi caricamenti, riprova tra un minuto.' });
  },
});
