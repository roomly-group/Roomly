import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import {
  API_BASE_PATH,
  API_ROUTE_PATHS,
  VERIFICATION_VIDEO_MAX_SIZE_BYTES,
  type AdminVerificationsList,
  type DecideVerificationInput,
  type MyVerification,
  type StartVerificationInput,
  type VerificationDocumentSide,
  type VerificationStatus,
} from '@workspace/api-zod';

// Identity verification: the user's flow (/verifica) and the reviewers' page
// (/admin/verifiche). Backend: routes/verification.ts.

// ===================== CONFIGURATION =====================

/** Document photos are shrunk to this longest edge before upload (px): sharp enough to read the MRZ. */
const DOCUMENT_PHOTO_MAX_EDGE_PX = 2000 as const;
/** JPEG quality of the shrunk document photo (0-1). */
const DOCUMENT_PHOTO_JPEG_QUALITY = 0.9 as const;

/** File types the document picker offers; anything the browser can decode is converted to JPEG. */
export const DOCUMENT_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif' as const;

const myVerificationUrl = `${API_BASE_PATH}${API_ROUTE_PATHS.ME_VERIFICATION}`;
const adminVerificationsUrl = `${API_BASE_PATH}${API_ROUTE_PATHS.ADMIN_VERIFICATIONS}`;

export const myVerificationQueryKey = [myVerificationUrl] as const;
const adminVerificationsQueryKey = (status: VerificationStatus) => [adminVerificationsUrl, status] as const;

/** The browser could not read the chosen file as an image. */
export class DocumentReadError extends Error {}
/** The video is larger than the backend accepts. */
export class VideoTooLargeError extends Error {}

// ===================== USER =====================

export function useMyVerification(enabled = true) {
  return useQuery({
    queryKey: myVerificationQueryKey,
    queryFn: () => customFetch<MyVerification>(myVerificationUrl, { method: 'GET', credentials: 'include' }),
    enabled,
  });
}

async function sendJson(url: string, body: unknown): Promise<MyVerification> {
  return customFetch<MyVerification>(url, { method: 'POST', credentials: 'include', body: JSON.stringify(body) });
}

async function sendFile(url: string, file: Blob, contentType: string): Promise<MyVerification> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  return (await response.json()) as MyVerification;
}

/** Calls the backend for each step of the flow; every call answers with the updated state. */
export const verificationApi = {
  start: (input: StartVerificationInput) => sendJson(myVerificationUrl, input),
  uploadDocument: (side: VerificationDocumentSide, photo: Blob) =>
    sendFile(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_VERIFICATION_DOCUMENT.replace(':side', side)}`, photo, 'image/jpeg'),
  uploadVideo: (video: Blob) => {
    if (video.size > VERIFICATION_VIDEO_MAX_SIZE_BYTES) throw new VideoTooLargeError();
    return sendFile(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_VERIFICATION_VIDEO}`, video, videoContentType(video));
  },
  submit: () => sendJson(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_VERIFICATION_SUBMIT}`, {}),
  setTrainingConsent: (consent: boolean) =>
    sendJson(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_VERIFICATION_TRAINING_CONSENT}`, { consent }),
};

export type VerificationApi = typeof verificationApi;

/** The upload Content-Type for a recorded or picked video ("video/webm;codecs=vp8" -> "video/webm"). */
function videoContentType(video: Blob): string {
  const base = video.type.split(';')[0].trim().toLowerCase();
  return base === 'video/webm' || base === 'video/quicktime' ? base : 'video/mp4';
}

/** Keeps the whole document (no crop), shrunk to DOCUMENT_PHOTO_MAX_EDGE_PX, as JPEG. */
export async function shrinkDocumentPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new DocumentReadError();
  }
  const scale = Math.min(1, DOCUMENT_PHOTO_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new DocumentReadError();
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new DocumentReadError())), 'image/jpeg', DOCUMENT_PHOTO_JPEG_QUALITY);
  });
}

// ===================== REVIEWERS =====================

export function useAdminVerifications(status: VerificationStatus, enabled = true) {
  return useQuery({
    queryKey: adminVerificationsQueryKey(status),
    queryFn: () =>
      customFetch<AdminVerificationsList>(`${adminVerificationsUrl}?status=${status}`, {
        method: 'GET',
        credentials: 'include',
      }),
    enabled,
  });
}

/** Approves or rejects an attempt, then refreshes every reviewer list. */
export function useDecideVerification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: DecideVerificationInput & { id: number }) =>
      customFetch<{ success: boolean }>(
        `${API_BASE_PATH}${API_ROUTE_PATHS.ADMIN_VERIFICATION_DECISION.replace(':id', String(id))}`,
        { method: 'POST', credentials: 'include', body: JSON.stringify(input) },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: [adminVerificationsUrl] }),
  });
}
