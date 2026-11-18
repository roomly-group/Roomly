import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { getListListingsQueryKey, listListings, type Listing, type ListListingsParams } from '@workspace/api-client-react';
import { LISTINGS_PAGE_QUERY_PARAM, LISTINGS_PAGE_SIZE } from '@workspace/api-zod';

// Search results one page at a time (RMY-13). GET /api/listings returns at
// most LISTINGS_PAGE_SIZE rooms per call; the search page asks for the next
// page while the student scrolls (infinite scroll, see pages/search.tsx).

// ===================== CONFIGURATION =====================

/** First page index the backend accepts (0-based). */
const FIRST_PAGE = 0 as const;
/** Extra query-key part, so these paged results never mix with the single-page cache of useListListings. */
const PAGED_QUERY_KEY_SUFFIX = 'paged' as const;

/** The usual listing filters plus the page to fetch. */
type PagedListingsParams = ListListingsParams & { [LISTINGS_PAGE_QUERY_PARAM]: number };

/**
 * Loads search results page by page. `listings` is every page loaded so far,
 * in order; `hasNextPage` is false once a page came back shorter than
 * LISTINGS_PAGE_SIZE (the backend has nothing more).
 */
export function useSearchListings(params: ListListingsParams) {
  const query = useInfiniteQuery({
    queryKey: [...getListListingsQueryKey(params), PAGED_QUERY_KEY_SUFFIX],
    initialPageParam: FIRST_PAGE as number,
    queryFn: ({ pageParam, signal }) => {
      const pagedParams: PagedListingsParams = { ...params, [LISTINGS_PAGE_QUERY_PARAM]: pageParam };
      return listListings(pagedParams, { signal });
    },
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length < LISTINGS_PAGE_SIZE ? undefined : lastPageParam + 1,
    // Keep the previous results on screen while a new budget or university loads.
    placeholderData: keepPreviousData,
  });

  // One flat list for the grid. Deduplicated by id: if a room is published
  // while the student scrolls, the pages shift by one and a room could repeat.
  const listings = useMemo<Listing[]>(() => {
    const seen = new Set<number>();
    return (query.data?.pages ?? []).flat().filter((listing) => {
      if (seen.has(listing.id)) return false;
      seen.add(listing.id);
      return true;
    });
  }, [query.data]);

  return { ...query, listings };
}
