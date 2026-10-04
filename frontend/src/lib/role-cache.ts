// Cache condivisa del ruolo/owner dell'utente (risposta di /api/me/role).
// Tutti i guard e la navbar la leggono da qui, quindi /api/me/role viene
// chiamato una volta ogni TTL invece che a ogni navigazione.
export type CachedRole = { role: 'admin' | 'user'; owner: boolean };

const TTL_MS = 5 * 60 * 1000;

let cached: { value: CachedRole; at: number } | null = null;
let inflight: Promise<CachedRole | null> | null = null;

export function peekRoleCache(): CachedRole | null {
  return cached && Date.now() - cached.at < TTL_MS ? cached.value : null;
}

export function setRoleCache(value: CachedRole) {
  cached = { value, at: Date.now() };
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
}
