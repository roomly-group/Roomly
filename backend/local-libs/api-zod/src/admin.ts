import * as zod from "zod";
import { ONBOARDING_OPTIONS } from "./constants";
import { VerificationRejectionReasonSchema } from "./verification";

// Admin dashboard (/admin): work queues and key numbers.
// Backend: GET /api/admin/stats (routes/admin.ts).

// ===================== CONFIGURATION =====================

/** Window used for "new this week" numbers (days). */
export const ADMIN_RECENT_WINDOW_DAYS = 7 as const;
/** Rows shown in each work queue on the dashboard. */
export const ADMIN_QUEUE_SIZE = 8 as const;

// ===================== SCHEMAS =====================

const IsoDate = zod.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");
const DiscoverySourceSchema = zod.enum(ONBOARDING_OPTIONS.sources);

/** A signed contract still to be registered with the Agenzia delle Entrate. */
export const AdminContractToRegister = zod.object({
  id: zod.number(),
  roomTitle: zod.string(),
  ownerName: zod.string(),
  studentName: zod.string(),
  signedOn: IsoDate,
  registrationDeadline: IsoDate,
});

/** A listing published in the last ADMIN_RECENT_WINDOW_DAYS days, to look over. */
export const AdminRecentListing = zod.object({
  id: zod.number(),
  title: zod.string(),
  city: zod.string(),
  ownerName: zod.string(),
  price: zod.number(),
  createdAt: zod.string(),
});

export const AdminStatsResponse = zod.object({
  generatedAt: zod.string(),
  users: zod.object({
    total: zod.number(),
    students: zod.number(),
    owners: zod.number(),
    newThisWeek: zod.number(),
    onboardingCompleted: zod.number(),
    invited: zod.number(),
  }),
  discoverySources: zod.array(zod.object({ source: DiscoverySourceSchema, count: zod.number() })),
  listings: zod.object({
    active: zod.number(),
    available: zod.number(),
    rented: zod.number(),
    newThisWeek: zod.number(),
  }),
  requests: zod.object({
    pending: zod.number(),
    accepted: zod.number(),
    rejected: zod.number(),
    cancelled: zod.number(),
  }),
  contracts: zod.object({
    active: zod.number(),
    toSign: zod.number(),
    toRegister: zod.number(),
    monthlyRentUnderContract: zod.number(),
  }),
  verifications: zod.object({
    pending: zod.number(),
    oldestPendingAt: zod.string().nullable(),
    approved: zod.number(),
    rejected: zod.number(),
    rejectionReasons: zod.array(zod.object({ reason: VerificationRejectionReasonSchema, count: zod.number() })),
  }),
  queues: zod.object({
    contractsToRegister: zod.array(AdminContractToRegister),
    recentListings: zod.array(AdminRecentListing),
  }),
});

export type AdminStats = zod.infer<typeof AdminStatsResponse>;
export type AdminContractToRegisterItem = zod.infer<typeof AdminContractToRegister>;
export type AdminRecentListingItem = zod.infer<typeof AdminRecentListing>;
