import { raw, Router, type IRouter, type Request, type Response } from "express";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { requireAdmin, requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { messageLimiter, photoUploadLimiter } from "../middleware/rateLimit.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { isValidImage, reencodeAsJpeg, uploadImageType, type PhotoBox } from "../lib/image.js";
import { stripVideoMetadata, VideoProcessingError } from "../lib/video.js";
import {
  VERIFICATION_BUCKET,
  VERIFICATION_TABLE,
  removeVerificationFiles,
  signedVerificationFileUrl,
} from "../lib/verification.js";
import {
  API_ROUTE_PATHS,
  DecideVerificationBody,
  ListAdminVerificationsResponse,
  MyVerificationResponse,
  StartVerificationBody,
  UpdateTrainingConsentBody,
  VERIFICATION_CHALLENGE_CODE_DIGITS,
  VERIFICATION_CHALLENGE_GESTURE_COUNT,
  VERIFICATION_DOCUMENT_MAX_SIZE_BYTES,
  VERIFICATION_GESTURES,
  VERIFICATION_STATUSES,
  VERIFICATION_VIDEO_MAX_SIZE_BYTES,
  VerificationDocumentSideSchema,
  type AdminVerification,
  type MyVerificationAttemptItem,
  type VerificationDocumentType,
  type VerificationGesture,
  type VerificationRejectionReason,
  type VerificationStatus,
} from "@workspace/api-zod";
import { errorForLog, logger } from "../lib/logger.js";

// Identity verification ("Verifica identità", /verifica in the frontend).
//
// The user:  starts an attempt (gets a random challenge) -> uploads the front
//            and back of an ID document -> uploads a short video in which they
//            say the code and do the gestures -> submits it.
// A reviewer (utenti.admin) sees the files at /admin/verifiche and approves or
// rejects. Files are private; reviewers get signed URLs that expire quickly.
// Table and bucket: migrations/011_verifiche_identita.sql.

// ===================== CONFIGURATION =====================

/** Stored document photos: never upscaled, at most this size (detail matters for the MRZ). */
const DOCUMENT_PHOTO_BOX: PhotoBox = { width: 2000, height: 2000, fit: "inside" };
/** Attempts shown per reviewer page. */
const ADMIN_PAGE_SIZE = 50 as const;
/** Video types accepted, and the file extension each one is stored with. */
const VIDEO_TYPES = {
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
} as const;

type VideoType = keyof typeof VIDEO_TYPES;

const ATTEMPT_COLUMNS =
  "id, utente_id, stato, tipo_documento, codice_sfida, gesti_sfida, consenso_addestramento, " +
  "documento_fronte, documento_retro, video, inviata_at, decisa_at, motivo_rifiuto, nota_revisore, " +
  "file_eliminati_at, created_at";

type AttemptRow = {
  id: number;
  utente_id: string;
  stato: VerificationStatus;
  tipo_documento: VerificationDocumentType;
  codice_sfida: string;
  gesti_sfida: VerificationGesture[];
  consenso_addestramento: boolean;
  documento_fronte: string | null;
  documento_retro: string | null;
  video: string | null;
  inviata_at: string | null;
  decisa_at: string | null;
  motivo_rifiuto: VerificationRejectionReason | null;
  nota_revisore: string | null;
  file_eliminati_at: string | null;
  created_at: string;
};

const router: IRouter = Router();

const IdParam = z.coerce.number().int().positive();

// ===================== HELPERS =====================

function serverError(res: Response, label: string, error: unknown) {
  logger.error({ error: errorForLog(error) }, label);
  return res.status(500).json({ error: "Internal server error" });
}

/** A code like "4729": random digits, leading zeros allowed. */
function randomChallengeCode(): string {
  return Array.from({ length: VERIFICATION_CHALLENGE_CODE_DIGITS }, () => String(randomInt(10))).join("");
}

/** A few different gestures in random order. */
function randomGestures(): VerificationGesture[] {
  const pool = [...VERIFICATION_GESTURES];
  const picked: VerificationGesture[] = [];
  while (picked.length < VERIFICATION_CHALLENGE_GESTURE_COUNT && pool.length > 0) {
    picked.push(pool.splice(randomInt(pool.length), 1)[0]);
  }
  return picked;
}

/** The type of a video upload, or null when it is not one we accept. */
function uploadVideoType(contentTypeHeader: string | undefined): VideoType | null {
  const contentType = contentTypeHeader?.split(";")[0].trim().toLowerCase();
  return contentType && contentType in VIDEO_TYPES ? (contentType as VideoType) : null;
}

/**
 * True when the bytes start like the declared video container: WebM (EBML
 * header) or MP4/QuickTime (an `ftyp` box right after the first size field).
 */
function isValidVideo(file: Buffer, type: VideoType): boolean {
  if (file.length < 12) return false;
  if (type === "video/webm") return file.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return file.toString("ascii", 4, 8) === "ftyp";
}

const toAttempt = (row: AttemptRow): MyVerificationAttemptItem => ({
  id: row.id,
  status: row.stato,
  documentType: row.tipo_documento,
  challengeCode: row.codice_sfida,
  challengeGestures: row.gesti_sfida,
  consentTraining: row.consenso_addestramento,
  hasFront: Boolean(row.documento_fronte),
  hasBack: Boolean(row.documento_retro),
  hasVideo: Boolean(row.video),
  submittedAt: row.inviata_at,
  rejectionReason: row.motivo_rifiuto,
  reviewerNote: row.nota_revisore,
});

/** The user's most recent attempt, or null. */
async function latestAttempt(userId: string): Promise<AttemptRow | null> {
  const { data, error } = await supabaseAdmin
    .from(VERIFICATION_TABLE)
    .select(ATTEMPT_COLUMNS)
    .eq("utente_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as unknown as AttemptRow | undefined) ?? null;
}

/** The user's approved attempt, if any (the most recent one). */
async function approvedAttempt(userId: string): Promise<AttemptRow | null> {
  const { data, error } = await supabaseAdmin
    .from(VERIFICATION_TABLE)
    .select(ATTEMPT_COLUMNS)
    .eq("utente_id", userId)
    .eq("stato", "approvata")
    .order("decisa_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as unknown as AttemptRow | undefined) ?? null;
}

/** The attempt the user is still filling in, or null. */
async function draftAttempt(userId: string): Promise<AttemptRow | null> {
  const { data, error } = await supabaseAdmin
    .from(VERIFICATION_TABLE)
    .select(ATTEMPT_COLUMNS)
    .eq("utente_id", userId)
    .eq("stato", "bozza")
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as AttemptRow | null) ?? null;
}

/** Name, surname and date of birth on the account: what the document must show. */
async function accountDetails(userId: string) {
  const { data, error } = await supabaseAdmin.from("utenti").select("nome, cognome, data_nascita").eq("id", userId).maybeSingle();
  if (error) throw error;
  const clean = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);
  return { firstName: clean(data?.nome), lastName: clean(data?.cognome), birthDate: clean(data?.data_nascita) };
}

async function readMyVerification(userId: string) {
  const [approved, latest, details] = await Promise.all([approvedAttempt(userId), latestAttempt(userId), accountDetails(userId)]);
  return MyVerificationResponse.parse({
    verified: approved !== null,
    verifiedAt: approved?.decisa_at ?? null,
    attempt: latest ? toAttempt(latest) : null,
    details,
    identityLocked: approved !== null || latest?.stato === "in_attesa",
  });
}

/** Saves one file of the draft attempt: uploads it, points the column at it, removes the previous one. */
async function storeDraftFile(
  attempt: AttemptRow,
  column: "documento_fronte" | "documento_retro" | "video",
  fileName: string,
  file: Buffer,
  contentType: string,
) {
  const path = `${attempt.utente_id}/${attempt.id}/${fileName}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(VERIFICATION_BUCKET)
    .upload(path, file, { contentType, upsert: true, cacheControl: "0" });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabaseAdmin
    .from(VERIFICATION_TABLE)
    .update({ [column]: path, updated_at: new Date().toISOString() })
    .eq("id", attempt.id)
    .eq("stato", "bozza");
  if (updateError) throw updateError;

  // A video re-recorded in another format lands under a new name: drop the old one.
  const previous = attempt[column];
  if (previous && previous !== path) await removeVerificationFiles([previous]);
}

// ===================== USER ROUTES =====================

/**
 * GET /api/me/verification
 * Whether the user is verified, and their latest attempt (with the challenge
 * while it is still a draft).
 */
router.get(API_ROUTE_PATHS.ME_VERIFICATION, requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  res.set("Cache-Control", "no-store");
  try {
    return res.json(await readMyVerification(userId));
  } catch (error) {
    return serverError(res, "Error reading verification:", error);
  }
});

/**
 * POST /api/me/verification
 * Starts a new attempt with a fresh challenge. A draft already in progress is
 * thrown away (files included), so the challenge is never reused.
 */
router.post(API_ROUTE_PATHS.ME_VERIFICATION, requireAuth, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const body = StartVerificationBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid verification data" });

  try {
    const [approved, latest] = await Promise.all([approvedAttempt(userId), latestAttempt(userId)]);
    if (approved) return res.status(409).json({ error: "Already verified" });
    if (latest?.stato === "in_attesa") return res.status(409).json({ error: "A verification is already under review" });

    // The reviewer compares these with the document: all three must be on the account.
    const details = await accountDetails(userId);
    if (!details.firstName || !details.lastName || !details.birthDate) {
      return res.status(400).json({ error: "Add your name, surname and date of birth before verifying", code: "DETAILS_MISSING" });
    }

    if (latest?.stato === "bozza") {
      await removeVerificationFiles([latest.documento_fronte, latest.documento_retro, latest.video]);
      const { error: deleteError } = await supabaseAdmin.from(VERIFICATION_TABLE).delete().eq("id", latest.id);
      if (deleteError) throw deleteError;
    }

    const { error } = await supabaseAdmin.from(VERIFICATION_TABLE).insert({
      utente_id: userId,
      tipo_documento: body.data.documentType,
      codice_sfida: randomChallengeCode(),
      gesti_sfida: randomGestures(),
      consenso_verifica_at: new Date().toISOString(),
      consenso_addestramento: body.data.consentTraining,
    });
    if (error) {
      // Unique index: another open attempt was created in the meantime.
      if ((error as { code?: string }).code === "23505") {
        return res.status(409).json({ error: "A verification is already open" });
      }
      throw error;
    }
    return res.status(201).json(await readMyVerification(userId));
  } catch (error) {
    return serverError(res, "Error starting verification:", error);
  }
});

/**
 * POST /api/me/verification/document/:side   (body: the JPEG/PNG bytes)
 * Front or back of the document. Only freshly encoded pixels are stored, so
 * EXIF data (GPS position included) never reaches storage.
 */
router.post(
  API_ROUTE_PATHS.ME_VERIFICATION_DOCUMENT,
  requireAuth,
  photoUploadLimiter,
  raw({ type: () => true, limit: VERIFICATION_DOCUMENT_MAX_SIZE_BYTES }),
  async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const side = VerificationDocumentSideSchema.safeParse(req.params.side);
    if (!side.success) return res.status(400).json({ error: "Invalid document side" });

    const contentType = uploadImageType(req.header("content-type"));
    if (!contentType) return res.status(400).json({ error: "Upload a JPG or PNG photo" });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0 || !isValidImage(req.body, contentType)) {
      return res.status(400).json({ error: "This photo cannot be read" });
    }

    let photo: Buffer;
    try {
      photo = await reencodeAsJpeg(req.body, DOCUMENT_PHOTO_BOX);
    } catch {
      return res.status(400).json({ error: "This photo cannot be read" });
    }

    try {
      const attempt = await draftAttempt(userId);
      if (!attempt) return res.status(409).json({ error: "Start a verification first" });
      const isFront = side.data === "front";
      await storeDraftFile(
        attempt,
        isFront ? "documento_fronte" : "documento_retro",
        isFront ? "fronte.jpg" : "retro.jpg",
        photo,
        "image/jpeg",
      );
      return res.status(201).json(await readMyVerification(userId));
    } catch (error) {
      return serverError(res, "Error uploading verification document:", error);
    }
  },
);

/**
 * POST /api/me/verification/video   (body: the WebM/MP4/MOV bytes)
 * The challenge video. Checked against the container signature, then copied
 * without its metadata (GPS position, device, date) before it is stored.
 */
router.post(
  API_ROUTE_PATHS.ME_VERIFICATION_VIDEO,
  requireAuth,
  photoUploadLimiter,
  raw({ type: () => true, limit: VERIFICATION_VIDEO_MAX_SIZE_BYTES }),
  async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const videoType = uploadVideoType(req.header("content-type"));
    if (!videoType) return res.status(400).json({ error: "Upload a WebM, MP4 or MOV video" });
    if (!Buffer.isBuffer(req.body) || !isValidVideo(req.body, videoType)) {
      return res.status(400).json({ error: "This video cannot be read" });
    }

    try {
      const attempt = await draftAttempt(userId);
      if (!attempt) return res.status(409).json({ error: "Start a verification first" });

      const extension = VIDEO_TYPES[videoType];
      let video: Buffer;
      try {
        video = await stripVideoMetadata(req.body, extension);
      } catch (err) {
        if (err instanceof VideoProcessingError) {
          logger.warn({ error: errorForLog(err) }, "Verification video rejected");
          return res.status(400).json({ error: "This video cannot be read" });
        }
        throw err;
      }
      await storeDraftFile(attempt, "video", `video.${extension}`, video, videoType);
      return res.status(201).json(await readMyVerification(userId));
    } catch (error) {
      return serverError(res, "Error uploading verification video:", error);
    }
  },
);

/**
 * POST /api/me/verification/submit
 * Sends the draft to the reviewers once both photos and the video are there.
 */
router.post(API_ROUTE_PATHS.ME_VERIFICATION_SUBMIT, requireAuth, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const attempt = await draftAttempt(userId);
    if (!attempt) return res.status(409).json({ error: "Nothing to submit" });
    if (!attempt.documento_fronte || !attempt.documento_retro || !attempt.video) {
      return res.status(400).json({ error: "Document photos and video are required" });
    }
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from(VERIFICATION_TABLE)
      .update({ stato: "in_attesa", inviata_at: now, updated_at: now })
      .eq("id", attempt.id)
      .eq("stato", "bozza")
      .select("id");
    if (error) throw error;
    if (!data?.length) return res.status(409).json({ error: "Nothing to submit" });
    return res.json(await readMyVerification(userId));
  } catch (error) {
    return serverError(res, "Error submitting verification:", error);
  }
});

/**
 * POST /api/me/verification/training-consent
 * Gives or withdraws the consent to use the user's files for training. Once
 * withdrawn, files of decided attempts are deleted at the next purge.
 */
router.post(API_ROUTE_PATHS.ME_VERIFICATION_TRAINING_CONSENT, requireAuth, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const body = UpdateTrainingConsentBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid consent" });
  try {
    const { error } = await supabaseAdmin
      .from(VERIFICATION_TABLE)
      .update({ consenso_addestramento: body.data.consent, updated_at: new Date().toISOString() })
      .eq("utente_id", userId);
    if (error) throw error;
    return res.json(await readMyVerification(userId));
  } catch (error) {
    return serverError(res, "Error updating training consent:", error);
  }
});

// ===================== REVIEWER ROUTES =====================

const AdminListQuery = z.object({
  status: z.enum(VERIFICATION_STATUSES).optional(),
});

type AdminRow = AttemptRow & {
  utente: {
    nome: string | null;
    cognome: string | null;
    email: string | null;
    data_nascita: string | null;
    owner: boolean | null;
  } | null;
};

/**
 * GET /api/admin/verifications?status=in_attesa
 * Attempts with the given status (default: waiting for review, oldest first),
 * with signed URLs to the photos and the video.
 */
router.get(API_ROUTE_PATHS.ADMIN_VERIFICATIONS, requireAuth, requireAdmin, async (req, res) => {
  const query = AdminListQuery.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: "Invalid filter" });
  const status = query.data.status ?? "in_attesa";
  res.set("Cache-Control", "no-store");

  try {
    const [list, pending] = await Promise.all([
      supabaseAdmin
        .from(VERIFICATION_TABLE)
        .select(`${ATTEMPT_COLUMNS}, utente:utente_id(nome, cognome, email, data_nascita, owner)`)
        .eq("stato", status)
        .order(status === "in_attesa" ? "inviata_at" : "updated_at", { ascending: status === "in_attesa" })
        .limit(ADMIN_PAGE_SIZE),
      supabaseAdmin
        .from(VERIFICATION_TABLE)
        .select("id", { count: "exact", head: true })
        .eq("stato", "in_attesa"),
    ]);
    if (list.error) throw list.error;
    if (pending.error) throw pending.error;

    const rows = (list.data ?? []) as unknown as AdminRow[];
    const items: AdminVerification[] = await Promise.all(
      rows.map(async (row) => {
        const [frontUrl, backUrl, videoUrl] = await Promise.all([
          signedVerificationFileUrl(row.documento_fronte),
          signedVerificationFileUrl(row.documento_retro),
          signedVerificationFileUrl(row.video),
        ]);
        return {
          id: row.id,
          status: row.stato,
          userId: row.utente_id,
          firstName: row.utente?.nome ?? null,
          lastName: row.utente?.cognome ?? null,
          email: row.utente?.email ?? null,
          birthDate: row.utente?.data_nascita ?? null,
          isOwner: row.utente?.owner === true,
          documentType: row.tipo_documento,
          challengeCode: row.codice_sfida,
          challengeGestures: row.gesti_sfida,
          consentTraining: row.consenso_addestramento,
          frontUrl,
          backUrl,
          videoUrl,
          submittedAt: row.inviata_at,
          decidedAt: row.decisa_at,
          rejectionReason: row.motivo_rifiuto,
          reviewerNote: row.nota_revisore,
          filesDeletedAt: row.file_eliminati_at,
        };
      }),
    );

    return res.json(ListAdminVerificationsResponse.parse({ items, pendingCount: pending.count ?? 0 }));
  } catch (error) {
    return serverError(res, "Error listing verifications:", error);
  }
});

/**
 * POST /api/admin/verifications/:id/decision
 * Approves or rejects an attempt that is waiting for review. The decision,
 * the reviewer and the reason are kept: they are the labels the Roomly
 * verification model learns from (for users who consented).
 */
router.post(API_ROUTE_PATHS.ADMIN_VERIFICATION_DECISION, requireAuth, requireAdmin, messageLimiter, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = IdParam.safeParse(req.params.id);
  const body = DecideVerificationBody.safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ error: "Invalid decision" });

  const approve = body.data.decision === "approve";
  const now = new Date().toISOString();
  try {
    const { data, error } = await supabaseAdmin
      .from(VERIFICATION_TABLE)
      .update({
        stato: approve ? "approvata" : "rifiutata",
        decisa_at: now,
        revisore_id: userId,
        motivo_rifiuto: approve ? null : body.data.reason,
        nota_revisore: body.data.note?.trim() || null,
        updated_at: now,
      })
      .eq("id", id.data)
      .eq("stato", "in_attesa")
      // A reviewer never decides their own verification: someone else must check it.
      .neq("utente_id", userId)
      .select("id");
    if (error) throw error;
    if (!data?.length) {
      return res.status(409).json({ error: "This verification is not waiting for review, or it is your own" });
    }
    return res.json({ success: true });
  } catch (error) {
    return serverError(res, "Error deciding verification:", error);
  }
});

export default router;
