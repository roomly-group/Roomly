import { WAITLIST_INVITE_BONUS } from "@workspace/api-zod";
import { supabaseAdmin } from "./supabase-admin.js";

/**
 * The waitlist position shown to a user: their signup order, moved up
 * WAITLIST_INVITE_BONUS places for each invited friend who finished the
 * onboarding (SQL function posizione_in_lista, migrations/007_inviti.sql).
 * Falls back to the raw signup order if the function is unavailable.
 */
export async function waitlistPosition(userId: string, signupOrder: number | null): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc("posizione_in_lista", {
    p_utente: userId,
    p_bonus: WAITLIST_INVITE_BONUS,
  });
  if (error || data === null || data === undefined) {
    if (error) console.warn("posizione_in_lista failed, showing signup order:", error.message);
    return signupOrder;
  }
  return Number(data);
}

/** Friends who signed up with this user's link and finished the onboarding. */
export async function countedInvites(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("utenti")
    .select("id", { count: "exact", head: true })
    .eq("invitato_da", userId)
    .not("onboarding_completato_at", "is", null);
  if (error) throw error;
  return count ?? 0;
}
