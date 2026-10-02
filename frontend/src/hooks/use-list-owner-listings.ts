import { useQuery } from '@tanstack/react-query';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import type { Listing } from '@workspace/api-zod';

export const getOwnerListingsUrl = () => {
  return `/api/owner/listings`;
};

export const getOwnerListings = async (): Promise<Listing[]> => {
  return customFetch<Listing[]>(getOwnerListingsUrl(), {
    method: 'GET',
    credentials: 'include',
  });
};

export const getOwnerListingsQueryKey = () => {
  return [`/api/owner/listings`] as const;
};

export type OwnerListingsQueryResult = NonNullable<Awaited<ReturnType<typeof getOwnerListings>>>;
export type OwnerListingsQueryError = ErrorType<unknown>;

export function useListOwnerListings<
  TData = OwnerListingsQueryResult,
  TError = OwnerListingsQueryError
>() {
  const query = useQuery({
    queryKey: getOwnerListingsQueryKey(),
    queryFn: getOwnerListings,
  });
  return query;
}

// Helper types for the query
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type ErrorType<T> = T extends { error: unknown } ? Error : unknown;
type NonNullable<T> = T extends null | undefined ? never : T;