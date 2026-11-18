import { supabaseAdmin } from "./supabase-admin.js";
import { errorForLog, logger } from "./logger.js";

/** Supabase storage bucket for profile photos (private, see migrations/006_onboarding.sql). */
export const PROFILE_PHOTO_BUCKET = "foto_profilo" as const;
/** Lifetime of signed profile-photo URLs (seconds). */
const PROFILE_PHOTO_URL_TTL_SECONDS = 3600 as const;

/**
 * Short-lived URLs for many stored profile photo paths with ONE storage
 * request. Returns path -> signed URL; paths that cannot be signed are
 * simply absent (the page then shows initials instead of a photo).
 */
export async function signedProfilePhotoUrls(paths: Array<string | null | undefined>): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (unique.length === 0) return signed;
  const { data, error } = await supabaseAdmin.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUrls(unique, PROFILE_PHOTO_URL_TTL_SECONDS);
  if (error) {
    logger.warn({ error: errorForLog(error) }, "Failed to sign profile photo URLs");
    return signed;
  }
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) signed.set(item.path, item.signedUrl);
  }
  return signed;
}

/** Short-lived URL for a stored profile photo path, or null. */
export async function signedProfilePhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(path, PROFILE_PHOTO_URL_TTL_SECONDS);
  if (error) {
    logger.warn({ error: errorForLog(error) }, "Failed to sign profile photo URL");
    return null;
  }
  return data.signedUrl;
}
