import * as zod from "zod";

// Identity verification ("Verifica identità"): document photos plus a short
// challenge video, reviewed by a Roomly admin. Backend: routes/verification.ts,
// table public.verifiche_identita (migrations/011_verifiche_identita.sql).

// ===================== CONFIGURATION =====================

/** Steps stored in `verifiche_identita.stato`. */
export const VERIFICATION_STATUSES = ["bozza", "in_attesa", "approvata", "rifiutata"] as const;

/** Documents accepted for the check (`verifiche_identita.tipo_documento`). */
export const VERIFICATION_DOCUMENT_TYPES = ["carta_identita", "passaporto", "patente", "permesso_soggiorno"] as const;

/** The two photos of the document, uploaded one at a time. */
export const VERIFICATION_DOCUMENT_SIDES = ["front", "back"] as const;

/** Gestures the challenge video can ask for; the backend picks a random set each attempt. */
export const VERIFICATION_GESTURES = [
  "turn_left",
  "turn_right",
  "look_up",
  "smile",
  "document_next_to_face",
  "tilt_document",
] as const;

/** Why a reviewer rejected an attempt (`verifiche_identita.motivo_rifiuto`). */
export const VERIFICATION_REJECTION_REASONS = [
  "document_unreadable",
  "document_expired",
  "name_mismatch",
  "face_mismatch",
  "challenge_not_done",
  "other",
] as const;

/** Digits in the code the user says out loud in the video. */
export const VERIFICATION_CHALLENGE_CODE_DIGITS = 4 as const;
/** Gestures asked for in each video. */
export const VERIFICATION_CHALLENGE_GESTURE_COUNT = 2 as const;
/** Longest challenge video the recorder allows (seconds). */
export const VERIFICATION_VIDEO_MAX_SECONDS = 30 as const;
/** Largest challenge video accepted by the backend (bytes, 30 MB). */
export const VERIFICATION_VIDEO_MAX_SIZE_BYTES = 31457280 as const;
/** Largest document photo accepted by the backend before re-encoding (bytes, 10 MB). */
export const VERIFICATION_DOCUMENT_MAX_SIZE_BYTES = 10485760 as const;
/** Days the files of a decided attempt are kept when the user did not consent to training (days). */
export const VERIFICATION_FILE_RETENTION_DAYS = 7 as const;
/** Longest reviewer note (characters). */
export const VERIFICATION_REVIEWER_NOTE_MAX_LENGTH = 500 as const;

/** Error code when a locked name or date of birth is changed (HTTP 409). */
export const IDENTITY_LOCKED_CODE = "IDENTITY_LOCKED" as const;
/** Message sent with IDENTITY_LOCKED_CODE. */
export const IDENTITY_LOCKED_MESSAGE =
  "Nome, cognome e data di nascita non si possono cambiare: sono quelli controllati nella verifica dell'identità." as const;

// ===================== SCHEMAS =====================

export const VerificationStatusSchema = zod.enum(VERIFICATION_STATUSES);
export const VerificationDocumentTypeSchema = zod.enum(VERIFICATION_DOCUMENT_TYPES);
export const VerificationDocumentSideSchema = zod.enum(VERIFICATION_DOCUMENT_SIDES);
export const VerificationGestureSchema = zod.enum(VERIFICATION_GESTURES);
export const VerificationRejectionReasonSchema = zod.enum(VERIFICATION_REJECTION_REASONS);

/** The attempt the user is working on or waiting for. */
export const MyVerificationAttempt = zod.object({
  id: zod.number(),
  status: VerificationStatusSchema,
  documentType: VerificationDocumentTypeSchema,
  challengeCode: zod.string(),
  challengeGestures: zod.array(VerificationGestureSchema),
  consentTraining: zod.boolean(),
  hasFront: zod.boolean(),
  hasBack: zod.boolean(),
  hasVideo: zod.boolean(),
  submittedAt: zod.string().nullable(),
  rejectionReason: VerificationRejectionReasonSchema.nullable(),
  reviewerNote: zod.string().nullable(),
});

/** GET /me/verification: where the user stands. `attempt` is the latest one, null if they never started. */
export const MyVerificationResponse = zod.object({
  verified: zod.boolean(),
  verifiedAt: zod.string().nullable(),
  attempt: MyVerificationAttempt.nullable(),
  /** The account details the reviewer compares with the document; null when missing. */
  details: zod.object({
    firstName: zod.string().nullable(),
    lastName: zod.string().nullable(),
    birthDate: zod.string().nullable(),
  }),
  /** Name and date of birth can no longer change (under review or verified). */
  identityLocked: zod.boolean(),
});

/** POST /me/verification: starts a new attempt with a fresh challenge. */
export const StartVerificationBody = zod.object({
  documentType: VerificationDocumentTypeSchema,
  /** The verification itself cannot run without it. */
  consentVerification: zod.literal(true),
  /** The user confirmed name, surname and date of birth match the document. */
  confirmDetails: zod.literal(true),
  /** Optional: lets Roomly keep the files to train its verification model. */
  consentTraining: zod.boolean(),
});

/** POST /me/verification/training-consent: changes the training consent of every attempt. */
export const UpdateTrainingConsentBody = zod.object({
  consent: zod.boolean(),
});

/** One attempt as a reviewer sees it (GET /admin/verifications). */
export const AdminVerificationItem = zod.object({
  id: zod.number(),
  status: VerificationStatusSchema,
  userId: zod.string(),
  firstName: zod.string().nullable(),
  lastName: zod.string().nullable(),
  email: zod.string().nullable(),
  birthDate: zod.string().nullable(),
  isOwner: zod.boolean(),
  documentType: VerificationDocumentTypeSchema,
  challengeCode: zod.string(),
  challengeGestures: zod.array(VerificationGestureSchema),
  consentTraining: zod.boolean(),
  /** Short-lived signed URLs; null once the files were deleted. */
  frontUrl: zod.string().nullable(),
  backUrl: zod.string().nullable(),
  videoUrl: zod.string().nullable(),
  submittedAt: zod.string().nullable(),
  decidedAt: zod.string().nullable(),
  rejectionReason: VerificationRejectionReasonSchema.nullable(),
  reviewerNote: zod.string().nullable(),
  filesDeletedAt: zod.string().nullable(),
});

export const ListAdminVerificationsResponse = zod.object({
  items: zod.array(AdminVerificationItem),
  /** Attempts waiting for a reviewer, whatever filter is shown. */
  pendingCount: zod.number(),
});

/** POST /admin/verifications/:id/decision */
export const DecideVerificationBody = zod
  .object({
    decision: zod.enum(["approve", "reject"]),
    reason: VerificationRejectionReasonSchema.optional(),
    note: zod.string().trim().max(VERIFICATION_REVIEWER_NOTE_MAX_LENGTH).optional(),
  })
  .refine((body) => body.decision === "approve" || body.reason !== undefined, {
    message: "A rejection needs a reason",
    path: ["reason"],
  });

export type VerificationStatus = zod.infer<typeof VerificationStatusSchema>;
export type VerificationDocumentType = zod.infer<typeof VerificationDocumentTypeSchema>;
export type VerificationDocumentSide = zod.infer<typeof VerificationDocumentSideSchema>;
export type VerificationGesture = zod.infer<typeof VerificationGestureSchema>;
export type VerificationRejectionReason = zod.infer<typeof VerificationRejectionReasonSchema>;
export type MyVerificationAttemptItem = zod.infer<typeof MyVerificationAttempt>;
export type MyVerification = zod.infer<typeof MyVerificationResponse>;
export type StartVerificationInput = zod.infer<typeof StartVerificationBody>;
export type AdminVerification = zod.infer<typeof AdminVerificationItem>;
export type AdminVerificationsList = zod.infer<typeof ListAdminVerificationsResponse>;
export type DecideVerificationInput = zod.infer<typeof DecideVerificationBody>;
