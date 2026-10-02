import { useEffect, useState } from 'react';

// The list is small and rarely changes, so it is fetched once per page load
// and shared between every search field (home + search page).
let cache: string[] | null = null;
let inflight: Promise<string[]> | null = null;

function loadUniversities(): Promise<string[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch('/api/universita')
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        cache = Array.isArray(data) ? (data as string[]) : [];
        return cache;
      })
      .catch(() => [] as string[])
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useUniversities() {
  const [universities, setUniversities] = useState<string[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let active = true;
    loadUniversities().then((list) => {
      if (!active) return;
      setUniversities(list);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { universities, loading };
}
