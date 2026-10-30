import { supabaseAdmin } from "./supabase-admin.js";

/**
 * Frees a rented room: public.libera_stanza cancels the accepted request,
 * sets the room back to "disponibile" and posts a system message in the chat.
 * Contracts of that room that were never signed are cancelled too, so they
 * do not linger as drafts for a request that no longer exists.
 *
 * Returns the RPC error (codes RM001 not owner, RM005 missing room, RM006 no
 * accepted request) or null on success.
 */
export async function releaseRoom(roomId: number, ownerId: string) {
  const { error } = await supabaseAdmin.rpc("libera_stanza", {
    p_stanza_id: roomId,
    p_owner_id: ownerId,
  });
  if (error) return error;

  const { error: contractsError } = await supabaseAdmin
    .from("contratti")
    .update({ stato: "annullato", updated_at: new Date().toISOString() })
    .eq("stanza_id", roomId)
    .eq("proprietario_id", ownerId)
    .in("stato", ["bozza", "in_attesa_firma"]);
  if (contractsError) console.error("Failed to cancel unsigned contracts of a released room:", contractsError);
  return null;
}
