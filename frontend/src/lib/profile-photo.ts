import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';

// Profile photo upload, shared by the onboarding and the profile page.
// Backend: POST /api/me/photo (routes/onboarding.ts).

// ===================== CONFIGURATION =====================

/** Profile photos are cropped square and shrunk to this edge before upload (px). */
const PROFILE_PHOTO_EDGE_PX = 640 as const;
/** JPEG quality of the shrunk profile photo (0-1). */
const PROFILE_PHOTO_JPEG_QUALITY = 0.86 as const;

/** File types the picker offers; anything the browser can decode is converted to JPEG. */
export const PROFILE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif' as const;

/** The browser could not read the chosen file as an image. */
export class PhotoReadError extends Error {}

/** Square centre crop, shrunk to PROFILE_PHOTO_EDGE_PX, as JPEG: small uploads, same shape everywhere. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PhotoReadError();
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const edge = Math.min(PROFILE_PHOTO_EDGE_PX, side);
  const canvas = document.createElement('canvas');
  canvas.width = edge;
  canvas.height = edge;
  const context = canvas.getContext('2d');
  if (!context) throw new PhotoReadError();
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, edge, edge);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new PhotoReadError())), 'image/jpeg', PROFILE_PHOTO_JPEG_QUALITY);
  });
}

/** Uploads an already shrunk photo; resolves to its signed URL. */
export async function uploadProfilePhoto(photo: Blob): Promise<string> {
  const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_PHOTO}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'image/jpeg' },
    body: photo,
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  const { foto_profilo_url: url } = (await response.json()) as { foto_profilo_url: string | null };
  if (!url) throw new Error('No photo URL');
  return url;
}
