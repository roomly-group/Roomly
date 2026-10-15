import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { API_BASE_PATH } from "@workspace/api-zod";

// ===================== CONFIGURATION =====================

/** Production origin permitted by backend CORS. */
const PRODUCTION_CORS_ORIGIN = "https://www.roomly.group" as const;
/** Local development origin permitted by backend CORS. */
const LOCALHOST_CORS_ORIGIN = "http://localhost:5173" as const;
/** Loopback development origin permitted by backend CORS. */
const LOOPBACK_CORS_ORIGIN = "http://127.0.0.1:5173" as const;
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

const app: Express = express();

// Trust proxy headers if behind a reverse proxy (e.g., Nginx, AWS ELB, Heroku)
// Set to true to trust the proxy, or specify an array of trusted IPs.
// If not behind a proxy, set to false.
app.set('trust proxy', true);

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
// Determine allowed origins based on environment
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins: readonly string[] = isProduction
  ? [PRODUCTION_CORS_ORIGIN]
  : [LOCALHOST_CORS_ORIGIN, LOOPBACK_CORS_ORIGIN];

// Apply CORS middleware with restricted origins
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
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
