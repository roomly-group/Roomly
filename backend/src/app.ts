import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { isAllowedOrigin } from "./lib/origins.js";
import { requireOriginSecret } from "./middleware/originSecret.js";
import { API_BASE_PATH } from "@workspace/api-zod";

// ===================== CONFIGURATION =====================

/** Turnstile origin used by the Content Security Policy. */
const TURNSTILE_CSP_ORIGIN = "https://challenges.cloudflare.com" as const;
/** Geoapify origin used by the Content Security Policy. */
const GEOAPIFY_CSP_ORIGIN = "https://api.geoapify.com" as const;
/** Supabase origin pattern used by the Content Security Policy. */
const SUPABASE_CSP_ORIGIN_PATTERN = "https://*.supabase.co" as const;
/** Cache lifetime applied by HTTP Strict Transport Security (seconds). */
const HSTS_MAX_AGE_SECONDS = 31536000 as const;
/** Content Security Policy source tokens used by the directives below. */
const CSP_SOURCES = {
  SELF: "'self'",
  UNSAFE_INLINE: "'unsafe-inline'",
  NONE: "'none'",
  DATA: "data:",
  HTTPS: "https:",
} as const;
/** HTTP methods enabled for cross-origin API requests. */
const CORS_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
/** HTTP headers enabled for cross-origin API requests. */
const CORS_ALLOWED_HEADERS = ["Content-Type", "Authorization", "X-Requested-With"] as const;
/**
 * Number of X-Forwarded-For entries Railway's edge adds: the IP that connected
 * to Railway + the edge's own IP (measured in production). With 2, req.ip is
 * whoever connected to Railway, and anything a client wrote further left is
 * ignored, so it cannot be faked.
 *
 * Behind Vercel that "whoever" is a Vercel server, not the visitor: the real
 * visitor IP comes from Vercel's own header instead (see getClientIp in
 * middleware/originSecret.ts). req.ip is the fallback (local dev, or
 * ORIGIN_SECRET missing). Never set `true`: that trusts client-written values.
 */
const TRUST_PROXY_HOPS = 2 as const;

const app: Express = express();

app.set('trust proxy', TRUST_PROXY_HOPS);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Reject requests that skip Vercel and hit the Railway URL directly (see middleware/originSecret.ts).
app.use(requireOriginSecret);
// Apply CORS middleware with restricted origins (see lib/origins.ts)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: [...CORS_ALLOWED_METHODS],
  allowedHeaders: [...CORS_ALLOWED_HEADERS],
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: [CSP_SOURCES.SELF],
      // https://challenges.cloudflare.com: Turnstile CAPTCHA widget on the
      // signup page (script + the iframe it renders + its own XHR calls).
      scriptSrc: [CSP_SOURCES.SELF, CSP_SOURCES.UNSAFE_INLINE, TURNSTILE_CSP_ORIGIN], // Allow inline scripts for now (can be tightened)
      styleSrc: [CSP_SOURCES.SELF, CSP_SOURCES.UNSAFE_INLINE], // Allow inline styles for Tailwind/Vite
      imgSrc: [CSP_SOURCES.SELF, CSP_SOURCES.DATA, CSP_SOURCES.HTTPS],
      connectSrc: [CSP_SOURCES.SELF, GEOAPIFY_CSP_ORIGIN, SUPABASE_CSP_ORIGIN_PATTERN, TURNSTILE_CSP_ORIGIN], // Allow Supabase + Turnstile connections
      fontSrc: [CSP_SOURCES.SELF],
      objectSrc: [CSP_SOURCES.NONE],
      mediaSrc: [CSP_SOURCES.SELF],
      frameSrc: [TURNSTILE_CSP_ORIGIN], // Turnstile renders its challenge in an iframe
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: true,
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: {
    maxAge: HSTS_MAX_AGE_SECONDS, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(API_BASE_PATH, router);

export default app;
