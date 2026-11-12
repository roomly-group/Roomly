import { supabaseAdmin } from "./supabase-admin.js";

// Blocks between users (table public.blocchi_utenti, migrations/019).
// A block works both ways for messaging: when A blocks B, neither can write
// to the other or open a new request with the other. Only the blocker sees
// the chat as "blocked by me" and can lift the block (routes/safety.ts).

// ===================== CONFIGURATION =====================

/** Table holding one row per (blocker, blocked) pair. */
export const BLOCKS_TABLE = "blocchi_utenti" as const;

/** Shape of a user id (UUID). Ids go inside PostgREST filter strings, so anything else is refused. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ===================== HELPERS =====================

/** Throws unless the value is a UUID: keeps `.or()` filter strings free of injected syntax. */
function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new Error("Invalid user id");
}

export type UserBlocks = {
  /** People this user blocked. */
  blockedByMe: Set<string>;
  /** People who blocked this user. */
  blockedMe: Set<string>;
};

/** Every block that involves the user, in both directions (one query). */
export async function loadUserBlocks(userId: string): Promise<UserBlocks> {
  assertUuid(userId);
  const { data, error } = await supabaseAdmin
    .from(BLOCKS_TABLE)
    .select("bloccante_id, bloccato_id")
    .or(`bloccante_id.eq.${userId},bloccato_id.eq.${userId}`);
  if (error) throw error;

  const blocks: UserBlocks = { blockedByMe: new Set(), blockedMe: new Set() };
  for (const row of (data ?? []) as Array<{ bloccante_id: string; bloccato_id: string }>) {
    if (row.bloccante_id === userId) blocks.blockedByMe.add(row.bloccato_id);
    else blocks.blockedMe.add(row.bloccante_id);
  }
  return blocks;
}

/** True when either of the two users blocked the other. */
export async function isBlockedBetween(firstUserId: string, secondUserId: string): Promise<boolean> {
  assertUuid(firstUserId);
  assertUuid(secondUserId);
  const { count, error } = await supabaseAdmin
    .from(BLOCKS_TABLE)
    .select("bloccante_id", { count: "exact", head: true })
    .or(
      `and(bloccante_id.eq.${firstUserId},bloccato_id.eq.${secondUserId}),and(bloccante_id.eq.${secondUserId},bloccato_id.eq.${firstUserId})`,
    );
  if (error) throw error;
  return (count ?? 0) > 0;
}
