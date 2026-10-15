import { storage } from '@/lib/storage';

// Cache condivisa del ruolo/owner dell'utente (risposta di /api/me/role).
// Tutti i guard e la navbar la leggono da qui, quindi /api/me/role viene
// chiamato una volta ogni TTL invece che a ogni navigazione.
export type CachedRole = { role: 'admin' | 'user'; owner: boolean };

// ===================== CONFIGURATION =====================

/** Duration before cached role information expires and may be refreshed (ms). */
const ROLE_CACHE_TTL_MS = 300000 as const;
/** localStorage key holding the last known role, so a reload starts from it. */
const ROLE_STORAGE_KEY = 'roomly.lastKnownRole' as const;

function readStoredRole(): CachedRole | null {
  try {
    const parsed = JSON.parse(storage.get(ROLE_STORAGE_KEY) ?? 'null') as Partial<CachedRole> | null;
    if (!parsed || (parsed.role !== 'admin' && parsed.role !== 'user')) return null;
    return { role: parsed.role, owner: parsed.owner === true };
  } catch {
    return null;
  }
}

let cached: { value: CachedRole; at: number } | null = null;
let inflight: Promise<CachedRole | null> | null = null;
// Ultimo ruolo noto (anche scaduto il TTL, anche dopo un ricaricamento): navbar
// e guard ripartono da qui invece che da "false" o da una schermata di caricamento,
// e verificano in background.
let lastKnown: CachedRole | null = readStoredRole();

export function peekRoleCache(): CachedRole | null {
  return cached && Date.now() - cached.at < ROLE_CACHE_TTL_MS ? cached.value : null;
}

export function setRoleCache(value: CachedRole) {
  cached = { value, at: Date.now() };
  lastKnown = value;
  storage.set(ROLE_STORAGE_KEY, JSON.stringify(value));
}

export function peekLastKnownRole(): CachedRole | null {
  return lastKnown;
}

export function getRoleInflight() {
  return inflight;
}

export function setRoleInflight(promise: Promise<CachedRole | null> | null) {
  inflight = promise;
}

// Da chiamare a login, registrazione e logout: il ruolo in cache non vale più.
export function clearRoleCache() {
  cached = null;
  inflight = null;
  lastKnown = null;
  storage.remove(ROLE_STORAGE_KEY);
}
