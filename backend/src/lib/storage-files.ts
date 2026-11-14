import { supabaseAdmin } from "./supabase-admin.js";

// Listing helpers for the private storage buckets, shared by lib/account.ts
// (account deletion) and lib/verification.ts (identity-file purge, RMY-03).

// ===================== CONFIGURATION =====================

/** Entries per storage list page (the Storage API returns at most 1000). */
const STORAGE_LIST_PAGE_SIZE = 1000 as const;

// ===================== LISTING =====================

type StorageEntry = { name: string; id: string | null };

/** Every entry directly inside `folder` ("" = bucket root), across all pages. */
async function listEntries(bucket: string, folder: string): Promise<StorageEntry[]> {
  const entries: StorageEntry[] = [];
  for (let offset = 0; ; offset += STORAGE_LIST_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list(folder, { limit: STORAGE_LIST_PAGE_SIZE, offset });
    if (error) throw error;
    entries.push(...((data ?? []) as StorageEntry[]));
    if (!data || data.length < STORAGE_LIST_PAGE_SIZE) return entries;
  }
}

/** Every file path under `folder` in `bucket`, going `depth` folders down. */
export async function listFiles(bucket: string, folder: string, depth: number): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await listEntries(bucket, folder)) {
    const path = folder ? `${folder}/${entry.name}` : entry.name;
    // Folders come back with a null id.
    if (entry.id === null) {
      if (depth > 1) paths.push(...(await listFiles(bucket, path, depth - 1)));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

/** Names of the folders directly inside `folder` ("" = bucket root). */
export async function listFolders(bucket: string, folder: string): Promise<string[]> {
  return (await listEntries(bucket, folder)).filter((entry) => entry.id === null).map((entry) => entry.name);
}
