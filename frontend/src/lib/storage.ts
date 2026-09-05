// Storage utility for handling session persistence
// This wrapper allows easy switching between storage mechanisms
// (sessionStorage, localStorage, cookies) in the future

export const storage = {
  get: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      // localStorage unavailable (e.g. private mode, blocked)
      return null;
    }
  },

  set: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // fail silently (e.g., private mode, quota exceeded)
    }
  },

  remove: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // fail silently
    }
  },
};