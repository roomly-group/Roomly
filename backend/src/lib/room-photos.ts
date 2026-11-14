import { supabaseAdmin } from "./supabase-admin.js";
import { errorForLog, logger } from "./logger.js";

// Listing photos: shared by the listing routes (routes/roomly.ts) and by
// account deletion / data export (lib/account.ts).

// ===================== CONFIGURATION =====================

/** Supabase storage bucket used for listing-room photos (private, see migrations/015). */
export const ROOM_PHOTO_BUCKET = "foto_stanze" as const;
/** Lifetime of generated signed room-photo URLs (seconds). */
const ROOM_PHOTO_URL_TTL_SECONDS = 3600 as const;

/**
 * Path inside ROOM_PHOTO_BUCKET of a stored `stanze_foto.url`. New rows hold
 * the path itself; old rows may hold a full public/signed Supabase URL.
 * Returns null for URLs that do not point into the bucket.
 */
export const getRoomPhotoPath = (storedUrl: string): string | null => {
  const markers = [
    `/object/public/${ROOM_PHOTO_BUCKET}/`,
    `/object/sign/${ROOM_PHOTO_BUCKET}/`,
  ];
  const marker = markers.find((candidate) => storedUrl.includes(candidate));
  if (!marker) return storedUrl.startsWith("http") ? null : storedUrl;

  try {
    return decodeURIComponent(storedUrl.slice(storedUrl.indexOf(marker) + marker.length).split("?", 1)[0]);
  } catch {
    return null;
  }
};

/** Short-lived URL for a stored listing photo, or null. */
export const createRoomPhotoSignedUrl = async (storedUrl: string): Promise<string | null> => {
  const path = getRoomPhotoPath(storedUrl);
  if (!path) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(ROOM_PHOTO_BUCKET)
    .createSignedUrl(path, ROOM_PHOTO_URL_TTL_SECONDS);

  if (error) {
    logger.warn({ error: errorForLog(error) }, "Failed to sign room photo URL");
    return null;
  }

  return data.signedUrl;
};

/**
 * Signs many stored listing photos with ONE storage request (createSignedUrls),
 * instead of one request per photo. Used by the search results, where every card
 * needs its cover. Returns a map storedUrl -> signed URL; photos that cannot be
 * signed (outside the bucket, missing file, storage error) are simply absent,
 * so the card falls back to its no-photo state.
 */
export const createRoomPhotoSignedUrls = async (storedUrls: string[]): Promise<Map<string, string>> => {
  const signed = new Map<string, string>();

  // storedUrl -> bucket path, skipping URLs that do not point into the bucket.
  const pathByStoredUrl = new Map<string, string>();
  for (const storedUrl of storedUrls) {
    const path = getRoomPhotoPath(storedUrl);
    if (path) pathByStoredUrl.set(storedUrl, path);
  }
  const paths = [...new Set(pathByStoredUrl.values())];
  if (paths.length === 0) return signed;

  const { data, error } = await supabaseAdmin.storage
    .from(ROOM_PHOTO_BUCKET)
    .createSignedUrls(paths, ROOM_PHOTO_URL_TTL_SECONDS);

  if (error) {
    logger.warn({ error: errorForLog(error) }, "Failed to sign room photo URLs");
    return signed;
  }

  const signedByPath = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) signedByPath.set(item.path, item.signedUrl);
  }
  for (const [storedUrl, path] of pathByStoredUrl) {
    const url = signedByPath.get(path);
    if (url) signed.set(storedUrl, url);
  }
  return signed;
};
