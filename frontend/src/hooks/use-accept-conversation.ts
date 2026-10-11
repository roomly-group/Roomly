import { useMutation } from '@tanstack/react-query';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import { AcceptConversationParams, AcceptConversationResponse } from '@workspace/api-zod';
import type { z } from 'zod';

export const getAcceptConversationUrl = (id: number) => {
  return `/api/conversations/${id}/accept`;
};

export const acceptConversation = async (params: z.infer<typeof AcceptConversationParams>): Promise<z.infer<typeof AcceptConversationResponse>> => {
  return customFetch<z.infer<typeof AcceptConversationResponse>>(getAcceptConversationUrl(params.id), {
    method: 'POST',
    credentials: 'include',
  });
};

export const getAcceptConversationKey = (id: number) => {
  return [`/api/conversations/${id}/accept`] as const;
};

export type AcceptConversationMutationResult = NonNullable<Awaited<ReturnType<typeof acceptConversation>>>;
export type AcceptConversationMutationError = ErrorType<unknown>;

export function useAcceptConversation<
  TData = AcceptConversationMutationResult,
  TError = AcceptConversationMutationError
>() {
  const mutation = useMutation({
    mutationFn: acceptConversation,
  });
  return mutation;
}

// Helper types for the mutation
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type ErrorType<T> = T extends { error: unknown } ? Error : unknown;
type NonNullable<T> = T extends null | undefined ? never : T;