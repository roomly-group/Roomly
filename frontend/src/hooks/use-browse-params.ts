import { useCallback, useMemo } from 'react';
import { useLocation, useSearch } from 'wouter';
import { APP_ROUTES } from '@/lib/constants';

/** Search state kept in the /search URL, so back, refresh and share keep it. */
export type BrowseParams = {
  zone: string;
  maxPrice: string;
  /** `tipologia_proprieta` value, '' = all types. */
  type: string;
  furnished: boolean;
  bills: boolean;
  pets: boolean;
  smokers: boolean;
};

export const BROWSE_FLAG_KEYS = ['furnished', 'bills', 'pets', 'smokers'] as const;
export type BrowseFlag = (typeof BROWSE_FLAG_KEYS)[number];

/** Keeps only a positive whole number of euros, '' otherwise. */
export const sanitizeBudget = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits && Number(digits) > 0 ? String(Number(digits)) : '';
};

export function parseBrowseParams(search: string): BrowseParams {
  const query = new URLSearchParams(search);
  return {
    zone: query.get('zone')?.trim() ?? '',
    maxPrice: sanitizeBudget(query.get('maxPrice') ?? ''),
    type: query.get('type') ?? '',
    furnished: query.get('furnished') === 'true',
    bills: query.get('bills') === 'true',
    pets: query.get('pets') === 'true',
    smokers: query.get('smokers') === 'true',
  };
}

export function browseHref(params: BrowseParams) {
  const query = new URLSearchParams();
  if (params.zone) query.set('zone', params.zone);
  if (params.maxPrice) query.set('maxPrice', params.maxPrice);
  if (params.type) query.set('type', params.type);
  for (const key of BROWSE_FLAG_KEYS) if (params[key]) query.set(key, 'true');
  const qs = query.toString();
  return `${APP_ROUTES.SEARCH}${qs ? `?${qs}` : ''}`;
}

/**
 * Reads the browse state from the URL and writes changes back to /search.
 * From any other page an update navigates to the results; on /search it
 * replaces the entry, so the back button leaves the results instead of
 * stepping through every keystroke.
 */
export function useBrowseParams() {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const onSearchPage = location === APP_ROUTES.SEARCH;
  const params = useMemo(() => parseBrowseParams(onSearchPage ? search : ''), [search, onSearchPage]);

  const update = useCallback(
    (patch: Partial<BrowseParams>) => {
      // Read the live URL, not the render-time params: two quick updates must not drop each other.
      const current = parseBrowseParams(onSearchPage ? window.location.search : '');
      const next = { ...current, ...patch };
      next.maxPrice = sanitizeBudget(next.maxPrice);
      next.zone = next.zone.trim();
      navigate(browseHref(next), { replace: onSearchPage });
    },
    [navigate, onSearchPage],
  );

  return { params, update, onSearchPage };
}
