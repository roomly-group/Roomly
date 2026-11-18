/**
 * An error whose message is already a friendly, translated text for the user
 * (RMY-14). Pages show `message` only for this class; anything else (network
 * failures like "Failed to fetch", JSON parse errors, server wording) gets
 * the page's generic translated message instead.
 */
export class UserFacingError extends Error {}

/** The text to show for a caught error: its message if it is a UserFacingError, else `fallback`. */
export function userFacingMessage(error: unknown, fallback: string): string {
  return error instanceof UserFacingError ? error.message : fallback;
}

/** Machine-readable `code` the backend adds to some error responses (e.g. "has_contracts"). */
export function apiErrorCode(error: unknown): string | undefined {
  const data = (error as { data?: unknown } | null)?.data;
  if (data && typeof data === 'object' && 'code' in data && typeof data.code === 'string') return data.code;
  return undefined;
}
