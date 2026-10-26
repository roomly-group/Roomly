import { supabaseAdmin } from "./supabase-admin.js";

/** Supabase storage bucket for profile photos (private, see migrations/006_onboarding.sql). */
export const PROFILE_PHOTO_BUCKET = "foto_profilo" as const;
/** Lifetime of signed profile-photo URLs (seconds). */
const PROFILE_PHOTO_URL_TTL_SECONDS = 3600 as const;

/** Short-lived URL for a stored profile photo path, or null. */
export async function signedProfilePhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(path, PROFILE_PHOTO_URL_TTL_SECONDS);
  if (error) {
    console.warn("Failed to sign profile photo URL:", error.message);
    return null;
  }
  return data.signedUrl;
}
