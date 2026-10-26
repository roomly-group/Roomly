import { supabaseAdmin } from "./supabase-admin.js";

// Crea il record in "utenti" per un utente che ha fatto login ma non ha
// ancora una riga (lazy creation), es. quando una route viene chiamata
// prima che il trigger `handle_email_confirmed` su auth.users abbia fatto
// in tempo a inserirla.
//
// IMPORTANTE: "posizione" NON è una colonna IDENTITY, è un BIGINT DEFAULT 0
// (vedi migration 202609040001). Se qui non calcoliamo esplicitamente il
// valore, la riga viene creata con posizione = 0, e quando il trigger del
// DB prova a inserirla a sua volta trova già la riga (ON CONFLICT DO
// NOTHING) e non la corregge più: l'utente resta bloccato a una posizione
// finta. Per questo calcoliamo qui la stessa logica del trigger.
export async function ensureUtenteRecord(userId: string) {
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (authError || !authUser) {
    return null;
  }

  const { email_confirmed_at } = authUser.user;
  if (!email_confirmed_at) {
    return null;
  }

  const { nome = "", cognome = "", data_nascita = null } = authUser.user.user_metadata ?? {};

  const { data: maxRow } = await supabaseAdmin
    .from("utenti")
    .select("posizione")
    .order("posizione", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosizione = (maxRow?.posizione ?? 0) + 1;

  // First, check if a record already exists
  const { data: existingUtente, error: selectError } = await supabaseAdmin
    .from("utenti")
    .select("data_nascita")
    .eq("id", userId)
    .single();

  // If we got an error that is not because the record doesn't exist, return null
  if (selectError && selectError.code !== 'PGRST116') {
    console.error("Failed to fetch utenti record:", selectError);
    return null;
  }

  // If record doesn't exist, insert it
  if (selectError && selectError.code === 'PGRST116') {
    const { error: insertError } = await supabaseAdmin.from("utenti").insert({
      id: userId,
      email: authUser.user.email ?? "",
      nome,
      cognome,
      email_verificata: true,
      posizione: nextPosizione,
      data_nascita,
    });

    if (insertError) {
      console.error("Failed to create utenti record:", insertError);
      return null;
    }
  } else {
    // Record exists - check if we need to update data_nascita
    if (
      existingUtente &&
      existingUtente.data_nascita === null &&
      data_nascita !== null &&
      data_nascita !== ''
    ) {
      const { error: updateError } = await supabaseAdmin
        .from("utenti")
        .update({ data_nascita })
        .eq("id", userId);

      if (updateError) {
        console.error("Failed to update utenti record with data_nascita:", updateError);
        return null;
      }
    }
    // If data_nascita is already set, we do nothing
  }

  // Fetch and return the complete record
  const { data: newRow, error: newError } = await supabaseAdmin
    .from("utenti")
    .select("nome, cognome, email, posizione, admin, owner, lingua, data_nascita")
    .eq("id", userId)
    .single();

  if (newError || !newRow) {
    return null;
  }

  return newRow;
}
