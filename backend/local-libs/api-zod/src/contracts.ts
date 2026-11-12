import * as zod from "zod";

// ===================== CONFIGURATION =====================

/** Contract steps stored in `public.contratti.stato` (CHECK in migrations/010_contratti.sql). */
export const CONTRACT_STATUSES = [
  "bozza",
  "in_attesa_firma",
  "firmato",
  "registrato",
  "concluso",
  "annullato",
] as const;

/**
 * Groups shown as filter tabs on the owner's contract page, derived by the
 * backend from the status and the dates:
 *   to_sign   draft or waiting for the student's signature
 *   active    signed (registered or not) and not close to its end
 *   expiring  signed and ending within CONTRACT_EXPIRING_WINDOW_DAYS
 *   ended     ended, past its end date, or cancelled
 */
export const CONTRACT_GROUPS = ["to_sign", "active", "expiring", "ended"] as const;

/** Actions that move a contract to its next step (POST /owner/contracts/:id/status). */
export const CONTRACT_ACTIONS = ["send_for_signature", "mark_signed", "mark_registered", "mark_ended", "cancel"] as const;

/** A signed contract counts as "expiring" when it ends within this window (days). */
export const CONTRACT_EXPIRING_WINDOW_DAYS = 90 as const;

/** Days allowed to register a contract, from signing or start date, whichever comes first (days). */
export const CONTRACT_REGISTRATION_DEADLINE_DAYS = 30 as const;

/** Maximum length of the registration details the owner writes down (characters). */
export const CONTRACT_REGISTRATION_REFERENCE_MAX_LENGTH = 120 as const;

// ===================== SCHEMAS =====================

const IsoDate = zod.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

export const ContractStatusSchema = zod.enum(CONTRACT_STATUSES);
export const ContractGroupSchema = zod.enum(CONTRACT_GROUPS);
export const ContractActionSchema = zod.enum(CONTRACT_ACTIONS);

export const OwnerContract = zod.object({
  id: zod.number(),
  status: ContractStatusSchema,
  group: ContractGroupSchema,
  roomId: zod.number(),
  roomTitle: zod.string(),
  roomAddress: zod.string(),
  studentName: zod.string(),
  studentPhotoUrl: zod.string().nullable(),
  studentUniversity: zod.string().nullable(),
  studentCourse: zod.string().nullable(),
  conversationId: zod.number().nullable(),
  startDate: IsoDate,
  endDate: IsoDate,
  months: zod.number(),
  monthlyRent: zod.number(),
  deposit: zod.number().nullable(),
  signatureRequestedAt: zod.string().nullable(),
  signedOn: IsoDate.nullable(),
  registeredOn: IsoDate.nullable(),
  registrationReference: zod.string().nullable(),
  /** Last day to register a signed contract (only while status is "firmato"). */
  registrationDeadline: IsoDate.nullable(),
  endedOn: IsoDate.nullable(),
  createdAt: zod.string(),
});

/** An accepted request that has no live contract yet: the starting point of "Nuovo contratto". */
export const ContractCandidate = zod.object({
  conversationId: zod.number(),
  roomId: zod.number(),
  roomTitle: zod.string(),
  roomAddress: zod.string(),
  studentName: zod.string(),
  suggestedMonthlyRent: zod.number(),
  suggestedStartDate: IsoDate.nullable(),
  suggestedEndDate: IsoDate.nullable(),
});

export const ListOwnerContractsResponse = zod.object({
  contracts: zod.array(OwnerContract),
  candidates: zod.array(ContractCandidate),
  /** Owner's rooms currently published (stanze.attiva). */
  publishedRooms: zod.number(),
  /** Today in Europe/Rome, the date every group above was computed against. */
  today: IsoDate,
});

export const CreateOwnerContractBody = zod
  .object({
    conversationId: zod.number().int().positive(),
    startDate: IsoDate,
    endDate: IsoDate,
    monthlyRent: zod.number().min(0).max(100_000),
    deposit: zod.number().min(0).max(100_000).nullable().optional(),
  })
  .refine((body) => body.endDate > body.startDate, { message: "End date must be after start date", path: ["endDate"] });

export const UpdateOwnerContractStatusBody = zod.object({
  action: ContractActionSchema,
  /** Signing, registration or end date, for the actions that need one. */
  date: IsoDate.optional(),
  registrationReference: zod.string().trim().max(CONTRACT_REGISTRATION_REFERENCE_MAX_LENGTH).optional(),
});

// ===================== STUDENT SIDE ("Il mio contratto") =====================

/**
 * Where a student is in one rental, shown as the step bar of the student's
 * contract page (GET /me/contract). Derived by the backend from the request
 * and the contract:
 *   request  request sent, the owner has not answered yet
 *   sign     request accepted: contract being prepared or waiting for the signature
 *   move_in  contract signed, the stay has not started yet (or starts today)
 *   stay     contract signed and the stay is running
 */
export const STUDENT_CONTRACT_STAGES = ["request", "sign", "move_in", "stay"] as const;

/** Request states a student can still follow on the contract page (conversazioni.stato_richiesta). */
export const STUDENT_OPEN_REQUEST_STATUSES = ["in_attesa", "accettata"] as const;

export const StudentContractStageSchema = zod.enum(STUDENT_CONTRACT_STAGES);

/** The contract terms the student needs, without the owner's bookkeeping (registration details). */
export const StudentContractDetails = zod.object({
  id: zod.number(),
  status: ContractStatusSchema,
  startDate: IsoDate,
  endDate: IsoDate,
  months: zod.number(),
  /** Month of the stay the student is in (1-based), only during the "stay" stage. */
  currentMonth: zod.number().nullable(),
  monthlyRent: zod.number(),
  deposit: zod.number().nullable(),
  signatureRequestedAt: zod.string().nullable(),
  signedOn: IsoDate.nullable(),
  registeredOn: IsoDate.nullable(),
});

/** One open rental of the student: a request still in play, or a live contract. */
export const StudentJourney = zod.object({
  stage: StudentContractStageSchema,
  /** Chat with the owner; null only if it was removed. */
  conversationId: zod.number().nullable(),
  requestStatus: zod.enum(STUDENT_OPEN_REQUEST_STATUSES).nullable(),
  requestedAt: zod.string().nullable(),
  acceptedAt: zod.string().nullable(),
  roomTitle: zod.string(),
  roomAddress: zod.string(),
  ownerName: zod.string(),
  ownerPhotoUrl: zod.string().nullable(),
  ownerVerified: zod.boolean(),
  contract: StudentContractDetails.nullable(),
});

/** A contract that is over (ended, or past its end date). */
export const StudentPastContract = zod.object({
  id: zod.number(),
  roomTitle: zod.string(),
  roomAddress: zod.string(),
  startDate: IsoDate,
  endDate: IsoDate,
  endedOn: IsoDate.nullable(),
});

export const StudentContractOverviewResponse = zod.object({
  /** Open rentals, the most advanced first: the page shows the first one. */
  journeys: zod.array(StudentJourney),
  pastContracts: zod.array(StudentPastContract),
  /** Today in Europe/Rome, the date every stage above was computed against. */
  today: IsoDate,
});

export type ContractStatus = zod.infer<typeof ContractStatusSchema>;
export type ContractGroup = zod.infer<typeof ContractGroupSchema>;
export type StudentContractStage = zod.infer<typeof StudentContractStageSchema>;
export type StudentJourneyItem = zod.infer<typeof StudentJourney>;
export type StudentPastContractItem = zod.infer<typeof StudentPastContract>;
export type StudentContractOverview = zod.infer<typeof StudentContractOverviewResponse>;
export type ContractAction = zod.infer<typeof ContractActionSchema>;
export type OwnerContractItem = zod.infer<typeof OwnerContract>;
export type ContractCandidateItem = zod.infer<typeof ContractCandidate>;
export type OwnerContractsList = zod.infer<typeof ListOwnerContractsResponse>;
export type CreateOwnerContractInput = zod.infer<typeof CreateOwnerContractBody>;
export type UpdateOwnerContractStatusInput = zod.infer<typeof UpdateOwnerContractStatusBody>;
