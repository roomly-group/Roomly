import * as zod from "zod";

// Safety tools (audit finding RMY-12): users report and block, admins act.
// Backend: routes/safety.ts and routes/chat.ts, tables public.segnalazioni and
// public.blocchi_utenti (migrations/019_segnalazioni_blocchi.sql).
// Users have no power over anyone else: a report only reaches the admin queue,
// a block only closes the blocker's own chats. Suspending a user, hiding a
// listing and closing a report are admin-only routes.

// ===================== CONFIGURATION =====================

/** What can be reported. The DB stores them as 'utente', 'messaggio', 'annuncio'. */
export const REPORT_TARGETS = ["user", "message", "listing"] as const;

/** Why something is reported (`segnalazioni.motivo`, same codes as the DB CHECK). */
export const REPORT_REASONS = ["scam", "fake_listing", "harassment", "spam", "inappropriate", "other"] as const;

/** The reasons offered for each target, in display order. */
export const REPORT_REASONS_BY_TARGET = {
  user: ["scam", "harassment", "spam", "inappropriate", "other"],
  message: ["scam", "harassment", "spam", "inappropriate", "other"],
  listing: ["scam", "fake_listing", "inappropriate", "other"],
} as const satisfies Record<(typeof REPORT_TARGETS)[number], readonly (typeof REPORT_REASONS)[number][]>;

/** Report states (`segnalazioni.stato`): waiting, action taken, nothing to do. */
export const REPORT_STATUSES = ["aperta", "risolta", "archiviata"] as const;

/** Longest text a reporter can add (characters, DB CHECK too). */
export const REPORT_DESCRIPTION_MAX_LENGTH = 1000 as const;
/** Longest internal note an admin can add when closing a report (characters, DB CHECK too). */
export const REPORT_ADMIN_NOTE_MAX_LENGTH = 1000 as const;
/** Reports listed per admin page (rows). */
export const ADMIN_REPORTS_PAGE_SIZE = 100 as const;
/** Messages an admin sees from a reported chat: the most recent ones (rows). */
export const ADMIN_REPORT_MESSAGES_LIMIT = 200 as const;

/** `code` of the answers refused because one of the two people blocked the other. */
export const SAFETY_ERROR_CODES = {
  /** Messages, new requests and accepting are refused between blocked users. */
  BLOCKED: "blocked",
  /** The target cannot be reported (gone, own message, own listing, deleted user). */
  NOT_REPORTABLE: "not_reportable",
  /** An admin tried to suspend themselves or another admin. */
  PROTECTED_ACCOUNT: "protected_account",
} as const;

// ===================== SCHEMAS =====================

export const ReportTargetSchema = zod.enum(REPORT_TARGETS);
export const ReportReasonSchema = zod.enum(REPORT_REASONS);
export const ReportStatusSchema = zod.enum(REPORT_STATUSES);

const ReportDescription = zod.string().trim().max(REPORT_DESCRIPTION_MAX_LENGTH).optional();
const PositiveId = zod.number().int().positive();

/**
 * POST /reports. The target is named by the id the app already has: the chat
 * (to report the other person), the message, or the listing. The backend works
 * out who is reported, so nobody can file a report about a user they never met.
 */
export const CreateReportBody = zod
  .discriminatedUnion("target", [
    zod.object({ target: zod.literal("user"), conversationId: PositiveId, reason: ReportReasonSchema, description: ReportDescription }),
    zod.object({ target: zod.literal("message"), messageId: PositiveId, reason: ReportReasonSchema, description: ReportDescription }),
    zod.object({ target: zod.literal("listing"), listingId: PositiveId, reason: ReportReasonSchema, description: ReportDescription }),
  ])
  .refine((body) => (REPORT_REASONS_BY_TARGET[body.target] as readonly string[]).includes(body.reason), {
    message: "This reason does not apply to this target",
    path: ["reason"],
  });

/** A person as an admin sees them on a report. */
const AdminReportPerson = zod.object({
  id: zod.string(),
  name: zod.string(),
  email: zod.string().nullable(),
});

/** One report as an admin sees it (GET /admin/reports). */
export const AdminReportItem = zod.object({
  id: zod.number(),
  target: ReportTargetSchema,
  reason: ReportReasonSchema,
  description: zod.string().nullable(),
  status: ReportStatusSchema,
  createdAt: zod.string(),
  /** Null once the reporter deleted their account. */
  reporter: AdminReportPerson.nullable(),
  /** Null once the reported person deleted their account. */
  reportedUser: AdminReportPerson.extend({
    /** utenti.stato: 'attivo', 'sospeso', 'eliminato'. */
    accountStatus: zod.string(),
    isAdmin: zod.boolean(),
    /** Every report ever filed about this person, this one included. */
    totalReports: zod.number(),
  }).nullable(),
  listing: zod.object({ id: zod.number(), title: zod.string(), active: zod.boolean() }).nullable(),
  /** The chat the report came from; admins can read it (GET /admin/reports/:id/messages). */
  conversationId: zod.number().nullable(),
  /** Copy of the reported message, taken when the report was filed. */
  messageText: zod.string().nullable(),
  handledAt: zod.string().nullable(),
  adminNote: zod.string().nullable(),
});

export const ListAdminReportsResponse = zod.object({
  items: zod.array(AdminReportItem),
  /** Reports waiting for an admin, whatever filter is shown. */
  openCount: zod.number(),
});

/** GET /admin/reports/:id/messages: the reported chat, oldest first. */
export const AdminReportMessagesResponse = zod.array(
  zod.object({
    id: zod.number(),
    /** reporter / reported: the two people of the report; system: request notices; deleted: author deleted their account. */
    from: zod.enum(["reporter", "reported", "system", "deleted"]),
    body: zod.string(),
    sentAt: zod.string(),
  }),
);

/** POST /admin/reports/:id/resolve: closes an open report. */
export const ResolveReportBody = zod.object({
  status: zod.enum(["risolta", "archiviata"]),
  note: zod.string().trim().max(REPORT_ADMIN_NOTE_MAX_LENGTH).optional(),
});

/** POST /admin/users/:id/status: suspends or reactivates an account. */
export const AdminUserStatusBody = zod.object({ suspended: zod.boolean() });

/** POST /admin/listings/:id/visibility: hides a listing from search or shows it again. */
export const AdminListingVisibilityBody = zod.object({ active: zod.boolean() });

export type ReportTarget = zod.infer<typeof ReportTargetSchema>;
export type ReportReason = zod.infer<typeof ReportReasonSchema>;
export type ReportStatus = zod.infer<typeof ReportStatusSchema>;
export type CreateReportInput = zod.infer<typeof CreateReportBody>;
export type AdminReport = zod.infer<typeof AdminReportItem>;
export type AdminReportsList = zod.infer<typeof ListAdminReportsResponse>;
export type AdminReportMessages = zod.infer<typeof AdminReportMessagesResponse>;
export type ResolveReportInput = zod.infer<typeof ResolveReportBody>;
