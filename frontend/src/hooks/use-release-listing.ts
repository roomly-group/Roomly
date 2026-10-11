import { useMutation } from '@tanstack/react-query';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import { ReleaseListingParams, ReleaseListingResponse } from '@workspace/api-zod';
import type { z } from 'zod';

export const getReleaseListingUrl = (id: number) => {
  return `/api/listings/${id}/release`;
};

export const releaseListing = async (params: z.infer<typeof ReleaseListingParams>): Promise<z.infer<typeof ReleaseListingResponse>> => {
  return customFetch<z.infer<typeof ReleaseListingResponse>>(getReleaseListingUrl(params.id), {
    method: 'POST',
    credentials: 'include',
  });
};

export const getReleaseListingKey = (id: number) => {
  return [`/api/listings/${id}/release`] as const;
};

export type ReleaseListingMutationResult = NonNullable<Awaited<ReturnType<typeof releaseListing>>>;
export type ReleaseListingMutationError = ErrorType<unknown>;

export function useReleaseListing<
  TData = ReleaseListingMutationResult,
  TError = ReleaseListingMutationError
>() {
  const mutation = useMutation({
    mutationFn: releaseListing,
  });
  return mutation;
}

// Helper types for the mutation
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type ErrorType<T> = T extends { error: unknown } ? Error : unknown;
type NonNullable<T> = T extends null | undefined ? never : T;