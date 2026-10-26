import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';

// Profilo dell'utente loggato (risposta di /api/me), condiviso da header,
// pagina profilo, pagina waitlist e lingua. Viene richiesto UNA volta per
// caricamento dell'app (le navigazioni successive lo leggono da qui) e salvato
// in localStorage, così anche dopo un ricaricamento nome ed email compaiono
// subito mentre la richiesta aggiorna i dati in background.
export type Account = {
  nome?: string | null;
  cognome?: string | null;
  full_name?: string | null;
  email?: string | null;
  posizione?: number | null;
  lingua?: string | null;
  /** Signed URL of the profile photo (expires after an hour; refreshed with /api/me). */
  foto_profilo_url?: string | null;
  /** False while the required onboarding steps are unfinished. */
  onboarding_completato?: boolean;
};

type Snapshot = {
  account: Account | null;
  /** idle: mai richiesto in questa sessione; loading: richiesta in corso; done: risposta arrivata. */
  status: 'idle' | 'loading' | 'done';
};

// ===================== CONFIGURATION =====================

/** localStorage key holding the last loaded account. */
const ACCOUNT_STORAGE_KEY = 'roomly.account' as const;

function readStoredAccount(): Account | null {
  try {
    const parsed = JSON.parse(storage.get(ACCOUNT_STORAGE_KEY) ?? 'null') as Account | null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

let snapshot: Snapshot = { account: readStoredAccount(), status: 'idle' };
let inflight: Promise<Account | null> | null = null;
// Cambia a ogni clear: una risposta arrivata dopo un logout non deve ripopolare la cache.
let generation = 0;
const listeners = new Set<() => void>();

function setSnapshot(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

/** Carica /api/me (una sola richiesta alla volta, una sola volta per sessione salvo `force`). */
export function loadAccount({ force = false }: { force?: boolean } = {}): Promise<Account | null> {
  if (inflight) return inflight;
  if (!force && snapshot.status === 'done') return Promise.resolve(snapshot.account);

  const requestGeneration = generation;
  setSnapshot({ ...snapshot, status: 'loading' });
  inflight = (async () => {
    let account: Account | null = snapshot.account;
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        account = null;
      } else {
        const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME}`, { credentials: 'include' });
        if (response.ok) account = (await response.json()) as Account;
        // Sessione non più valida: niente dati di un utente che non è più loggato.
        else if (response.status === 401) account = null;
      }
    } catch {
      // Errore di rete: si tiene l'ultimo valore noto.
    }

    if (requestGeneration === generation) {
      if (account) storage.set(ACCOUNT_STORAGE_KEY, JSON.stringify(account));
      else storage.remove(ACCOUNT_STORAGE_KEY);
      setSnapshot({ account, status: 'done' });
      inflight = null;
    }
    return account;
  })();
  return inflight;
}

/** Aggiorna localmente alcuni campi (es. la lingua appena salvata). */
export function patchAccount(fields: Partial<Account>) {
  if (!snapshot.account) return;
  const account = { ...snapshot.account, ...fields };
  storage.set(ACCOUNT_STORAGE_KEY, JSON.stringify(account));
  setSnapshot({ ...snapshot, account });
}

// Da chiamare a login, registrazione e logout: i dati salvati non valgono più.
export function clearAccountCache() {
  generation += 1;
  inflight = null;
  storage.remove(ACCOUNT_STORAGE_KEY);
  setSnapshot({ account: null, status: 'idle' });
}

/**
 * Profilo dell'utente per i componenti. `loading` è true solo quando non c'è
 * ancora niente da mostrare (né in cache né dalla rete).
 */
export function useAccount() {
  const { account, status } = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (status === 'idle') void loadAccount();
  }, [status]);

  return { account, loading: !account && status !== 'done' };
}
