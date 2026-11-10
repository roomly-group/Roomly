import { supabaseAdmin } from "./supabase-admin.js";
import { PROFILE_PHOTO_BUCKET, signedProfilePhotoUrl } from "./profile-photo.js";
import { VERIFICATION_BUCKET, VERIFICATION_TABLE } from "./verification.js";
import { ROOM_PHOTO_BUCKET, createRoomPhotoSignedUrl, getRoomPhotoPath } from "./room-photos.js";
import { DELETED_MESSAGE_TYPE } from "@workspace/api-zod";

// Account deletion (DELETE /api/me) and personal-data export (GET /api/me/export),
// GDPR Art. 15, 17 and 20. Used by routes/me.ts.
//
// Deletion order, chosen so no ID document or photo is ever left orphaned:
//   1. collect every storage path of the user (the DB rows that point to the
//      files are about to disappear, so this must happen first);
//   2. remove the files; on failure stop here, nothing in the DB has changed;
//   3. public.elimina_account deletes / anonymises every row in ONE transaction
//      (migrations/016_elimina_account.sql);
//   4. delete the auth.users row.
// Every step can be repeated, so a deletion that fails half-way is finished by
// simply trying again.

// ===================== CONFIGURATION =====================

/** How recent the user's last real login must be to delete the account (seconds, 10 minutes). */
export const ACCOUNT_DELETE_REAUTH_MAX_AGE_SECONDS = 600 as const;
/** `amr` methods that are NOT a real login, so they never count as a fresh sign-in. */
const NON_LOGIN_AMR_METHODS: readonly string[] = ["token_refresh"];
/** Postgres error code raised by public.elimina_account while a contract is not cancelled. */
const HAS_CONTRACTS_DB_ERROR_CODE = "RM007" as const;
/** Contract status that does NOT block a deletion. */
const CANCELLED_CONTRACT_STATUS = "annullato" as const;
/** Files removed per storage call (the Storage API caps one call at 1000). */
const STORAGE_REMOVE_BATCH_SIZE = 100 as const;
/** Entries per storage list page. */
const STORAGE_LIST_PAGE_SIZE = 1000 as const;
/** Rows per page when reading big tables (PostgREST returns at most 1000 rows). */
const ROWS_PAGE_SIZE = 1000 as const;
/** Conversation ids per `.in()` filter, keeps the request URL short. */
const ID_CHUNK_SIZE = 200 as const;
/** Folder depth of each bucket below the user/room folder: <uid>/<file>, <uid>/<attempt>/<file>, <room>/<file>. */
const FOLDER_DEPTH = { profile: 1, verification: 2, room: 1 } as const;
/** Name shown in the export for the other person of a chat when they deleted their account. */
const EXPORT_DELETED_USER_NAME = "Deleted user" as const;
/** Fallback name in the export when the other person has no name. */
const EXPORT_UNKNOWN_USER_NAME = "User" as const;
/** Note at the top of the export file. */
const EXPORT_NOTE =
  "Your personal data held by Roomly. Photo links stop working one hour after the export. Identity documents are not included as files: ask us at the address in the privacy policy if you want a copy." as const;

/** Files of one user, by bucket. */
type UserFiles = Record<typeof PROFILE_PHOTO_BUCKET | typeof VERIFICATION_BUCKET | typeof ROOM_PHOTO_BUCKET, string[]>;

// ===================== RE-AUTHENTICATION =====================

/**
 * Seconds since the user last really authenticated (password, Google, email
 * link) in the session this access token belongs to, or null when unknown.
 *
 * Read from the `amr` claim of the Supabase JWT: one entry per sign-in method
 * with the time it was used. Unlike `iat`, it does NOT move when the token is
 * refreshed, so an old stolen session can never pass as a fresh login.
 * The token itself was already verified by requireAuth (auth.getUser).
 */
export function secondsSinceLastSignIn(accessToken: string): number | null {
  try {
    const payloadPart = accessToken.split(".")[1];
    if (!payloadPart) return null;
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf-8")) as {
      amr?: Array<{ method?: unknown; timestamp?: unknown }>;
    };
    const timestamps = (Array.isArray(payload.amr) ? payload.amr : [])
      .filter((entry) => !NON_LOGIN_AMR_METHODS.includes(String(entry?.method)))
      .map((entry) => entry?.timestamp)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (timestamps.length === 0) return null;
    return Math.max(0, Math.floor(Date.now() / 1000) - Math.max(...timestamps));
  } catch {
    return null;
  }
}

// ===================== CONTRACTS =====================

/** True when the user (as student or owner) has a contract that is not cancelled. */
export async function hasOpenContracts(userId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from("contratti")
    .select("id", { count: "exact", head: true })
    .or(`studente_id.eq.${userId},proprietario_id.eq.${userId}`)
    .neq("stato", CANCELLED_CONTRACT_STATUS);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ===================== STORAGE =====================

/** Every file path under `folder` in `bucket`, going `depth` folders down. */
async function listFiles(bucket: string, folder: string, depth: number): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += STORAGE_LIST_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list(folder, { limit: STORAGE_LIST_PAGE_SIZE, offset });
    if (error) throw error;
    for (const entry of data ?? []) {
      const path = `${folder}/${entry.name}`;
      // Folders come back with a null id.
      if (entry.id === null) {
        if (depth > 1) paths.push(...(await listFiles(bucket, path, depth - 1)));
      } else {
        paths.push(path);
      }
    }
    if (!data || data.length < STORAGE_LIST_PAGE_SIZE) return paths;
  }
}

/**
 * All storage files of a user: profile photos, identity documents and videos,
 * and the photos of the listings they own. Both the folders and the paths
 * saved in the DB are read, so old or half-uploaded files are found too.
 */
async function collectUserFiles(userId: string): Promise<UserFiles> {
  const [profileRow, verificationRows, roomRows] = await Promise.all([
    supabaseAdmin.from("utenti").select("foto_profilo").eq("id", userId).maybeSingle(),
    supabaseAdmin.from(VERIFICATION_TABLE).select("documento_fronte, documento_retro, video").eq("utente_id", userId),
    supabaseAdmin.from("stanze").select("id, stanze_foto(url)").eq("proprietario_id", userId),
  ]);
  if (profileRow.error) throw profileRow.error;
  if (verificationRows.error) throw verificationRows.error;
  if (roomRows.error) throw roomRows.error;

  const rooms = (roomRows.data ?? []) as Array<{ id: number; stanze_foto: Array<{ url: string | null }> | null }>;
  const [profileFiles, verificationFiles, ...roomFolders] = await Promise.all([
    listFiles(PROFILE_PHOTO_BUCKET, userId, FOLDER_DEPTH.profile),
    listFiles(VERIFICATION_BUCKET, userId, FOLDER_DEPTH.verification),
    ...rooms.map((room) => listFiles(ROOM_PHOTO_BUCKET, String(room.id), FOLDER_DEPTH.room)),
  ]);

  const unique = (paths: (string | null | undefined)[]) =>
    [...new Set(paths.filter((path): path is string => Boolean(path)))];

  return {
    [PROFILE_PHOTO_BUCKET]: unique([...profileFiles, profileRow.data?.foto_profilo]),
    [VERIFICATION_BUCKET]: unique([
      ...verificationFiles,
      ...(verificationRows.data ?? []).flatMap((row) => [row.documento_fronte, row.documento_retro, row.video]),
    ]),
    [ROOM_PHOTO_BUCKET]: unique([
      ...roomFolders.flat(),
      ...rooms.flatMap((room) => (room.stanze_foto ?? []).map((photo) => (photo.url ? getRoomPhotoPath(photo.url) : null))),
    ]),
  };
}

/** Removes the files, in batches. Throws on the first failure. */
async function removeFiles(files: UserFiles): Promise<void> {
  for (const [bucket, paths] of Object.entries(files)) {
    for (let start = 0; start < paths.length; start += STORAGE_REMOVE_BATCH_SIZE) {
      const { error } = await supabaseAdmin.storage
        .from(bucket)
        .remove(paths.slice(start, start + STORAGE_REMOVE_BATCH_SIZE));
      if (error) throw error;
    }
  }
}

// ===================== DELETION =====================

/**
 * Deletes the account: files, database rows, then the login itself.
 * Returns "has_contracts" when a contract that is not cancelled blocks it.
 * Throws on any other failure (the caller answers 500; trying again is safe).
 */
export async function deleteAccount(userId: string): Promise<"deleted" | "has_contracts"> {
  await removeFiles(await collectUserFiles(userId));

  const { error: rowsError } = await supabaseAdmin.rpc("elimina_account", { p_utente: userId });
  if (rowsError) {
    if (rowsError.code === HAS_CONTRACTS_DB_ERROR_CODE) return "has_contracts";
    throw rowsError;
  }

  // Also ends every session and refresh token of the user.
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError) throw authError;
  return "deleted";
}

// ===================== EXPORT =====================

type PersonRow = { nome_utente?: string | null; nome?: string | null; cognome?: string | null } | null;

type ExportConversationRow = {
  id: number;
  stanza_id: number;
  studente_id: string | null;
  stato_richiesta: string;
  created_at: string;
  updated_at: string;
  deciso_at: string | null;
  stanza: { titolo: string | null; proprietario_id: string } | null;
  partecipanti: Array<{ utente_id: string; utente: PersonRow }> | null;
};

type ExportMessageRow = {
  id: number;
  conversazione_id: number;
  mittente_id: string | null;
  testo: string;
  tipo: string;
  letto: boolean;
  created_at: string;
};

const personName = (person: PersonRow | undefined): string => {
  const full = `${person?.nome ?? ""} ${person?.cognome ?? ""}`.trim();
  return person?.nome_utente || full || EXPORT_UNKNOWN_USER_NAME;
};

/** Reads every page of a query (PostgREST stops at 1000 rows per request). */
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += ROWS_PAGE_SIZE) {
    const { data, error } = await page(from, from + ROWS_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < ROWS_PAGE_SIZE) return rows;
  }
}

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

/** Ids of every chat the user is part of: as a member, as the student, or as the room owner. */
async function conversationIdsOf(userId: string, ownedRoomIds: number[]): Promise<number[]> {
  const [members, asStudent, asOwner] = await Promise.all([
    supabaseAdmin.from("conversazioni_utenti").select("conversazione_id").eq("utente_id", userId),
    supabaseAdmin.from("conversazioni").select("id").eq("studente_id", userId),
    ownedRoomIds.length > 0
      ? supabaseAdmin.from("conversazioni").select("id").in("stanza_id", ownedRoomIds)
      : Promise.resolve({ data: [] as Array<{ id: number }>, error: null }),
  ]);
  if (members.error) throw members.error;
  if (asStudent.error) throw asStudent.error;
  if (asOwner.error) throw asOwner.error;
  return [...new Set([
    ...(members.data ?? []).map((row) => row.conversazione_id as number),
    ...(asStudent.data ?? []).map((row) => row.id as number),
    ...(asOwner.data ?? []).map((row) => row.id as number),
  ])];
}

/** Every chat of the user with ALL its messages (both sides), oldest message first. */
async function exportConversations(userId: string, ownedRoomIds: number[]) {
  const ids = await conversationIdsOf(userId, ownedRoomIds);
  const conversations: ExportConversationRow[] = [];
  const messages: ExportMessageRow[] = [];

  for (const idChunk of chunks(ids, ID_CHUNK_SIZE)) {
    const { data, error } = await supabaseAdmin
      .from("conversazioni")
      .select(
        "id, stanza_id, studente_id, stato_richiesta, created_at, updated_at, deciso_at, stanza:stanza_id(titolo, proprietario_id), partecipanti:conversazioni_utenti(utente_id, utente:utente_id(nome_utente, nome, cognome))",
      )
      .in("id", idChunk);
    if (error) throw error;
    conversations.push(...((data ?? []) as unknown as ExportConversationRow[]));

    messages.push(...(await fetchAllRows<ExportMessageRow>((from, to) =>
      supabaseAdmin
        .from("messaggi")
        .select("id, conversazione_id, mittente_id, testo, tipo, letto, created_at")
        .in("conversazione_id", idChunk)
        .order("id", { ascending: true })
        .range(from, to),
    )));
  }

  const messagesByConversation = new Map<number, ExportMessageRow[]>();
  for (const message of messages) {
    const list = messagesByConversation.get(message.conversazione_id) ?? [];
    list.push(message);
    messagesByConversation.set(message.conversazione_id, list);
  }

  return conversations
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .map((conversation) => {
      const youAreOwner = conversation.stanza?.proprietario_id === userId;
      const other = (conversation.partecipanti ?? []).find((member) => member.utente_id !== userId);
      const otherDeleted = youAreOwner && conversation.studente_id === null;
      return {
        id: conversation.id,
        listing: { id: conversation.stanza_id, title: conversation.stanza?.titolo ?? null },
        yourRole: youAreOwner ? "owner" : "student",
        otherPerson: otherDeleted ? EXPORT_DELETED_USER_NAME : personName(other?.utente),
        requestStatus: conversation.stato_richiesta,
        createdAt: conversation.created_at,
        decidedAt: conversation.deciso_at,
        messages: (messagesByConversation.get(conversation.id) ?? []).map((message) => ({
          id: message.id,
          from:
            message.tipo === "sistema"
              ? "system"
              : message.tipo === DELETED_MESSAGE_TYPE
                ? "deleted_user"
                : message.mittente_id === userId
                  ? "you"
                  : "other",
          // The text of a deleted user's message was wiped: nothing to export.
          text: message.tipo === DELETED_MESSAGE_TYPE ? null : message.testo,
          sentAt: message.created_at,
          read: message.letto,
        })),
      };
    });
}

/**
 * Everything Roomly stores about the user, as one JSON document. Identity
 * documents are listed (status, dates, consent) but not attached; reviewer
 * ids are left out because they are someone else's data.
 */
export async function buildAccountExport(userId: string) {
  const [authResult, profileResult, preferencesResult, roomsResult, contractsResult, verificationsResult] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin.from("utenti").select("*, universita:universita_id(nome, citta)").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("preferenze_utenti").select("*").eq("utente_id", userId).maybeSingle(),
    supabaseAdmin
      .from("stanze")
      .select("*, stanze_foto(url, didascalia, copertina, ordine)")
      .eq("proprietario_id", userId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("contratti")
      .select("*, stanza:stanza_id(titolo)")
      .or(`studente_id.eq.${userId},proprietario_id.eq.${userId}`)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from(VERIFICATION_TABLE)
      .select(
        "id, stato, tipo_documento, consenso_verifica_at, consenso_addestramento, inviata_at, decisa_at, motivo_rifiuto, nota_revisore, file_eliminati_at, created_at, documento_fronte, documento_retro, video",
      )
      .eq("utente_id", userId)
      .order("created_at", { ascending: true }),
  ]);
  if (authResult.error) throw authResult.error;
  for (const result of [profileResult, preferencesResult, roomsResult, contractsResult, verificationsResult]) {
    if (result.error) throw result.error;
  }

  const authUser = authResult.data.user;
  const profile = profileResult.data as ({ foto_profilo?: string | null } & Record<string, unknown>) | null;
  const rooms = (roomsResult.data ?? []) as Array<
    { id: number; stanze_foto: Array<{ url: string | null; didascalia: string | null; copertina: boolean; ordine: number }> | null } & Record<string, unknown>
  >;

  const [profilePhotoUrl, listings, conversations] = await Promise.all([
    signedProfilePhotoUrl(profile?.foto_profilo),
    Promise.all(rooms.map(async ({ stanze_foto, ...room }) => ({
      ...room,
      photos: await Promise.all(
        [...(stanze_foto ?? [])]
          .sort((left, right) => left.ordine - right.ordine)
          .map(async (photo) => ({
            url: photo.url ? await createRoomPhotoSignedUrl(photo.url) : null,
            caption: photo.didascalia,
            cover: photo.copertina,
          })),
      ),
    }))),
    exportConversations(userId, rooms.map((room) => room.id)),
  ]);

  return {
    note: EXPORT_NOTE,
    exportedAt: new Date().toISOString(),
    account: {
      id: authUser.id,
      email: authUser.email ?? null,
      phone: authUser.phone || null,
      createdAt: authUser.created_at,
      emailConfirmedAt: authUser.email_confirmed_at ?? null,
      lastSignInAt: authUser.last_sign_in_at ?? null,
      signInMethods: (authUser.app_metadata?.providers as string[] | undefined) ?? [],
    },
    profile: profile ? { ...profile, foto_profilo_url: profilePhotoUrl } : null,
    preferences: preferencesResult.data ?? null,
    listings,
    conversations,
    contracts: contractsResult.data ?? [],
    identityVerifications: (verificationsResult.data ?? []).map(({ documento_fronte, documento_retro, video, ...attempt }) => ({
      ...attempt,
      filesStillStored: Boolean(documento_fronte || documento_retro || video),
    })),
  };
}
