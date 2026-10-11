import { useMutation } from '@tanstack/react-query';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import { RejectConversationParams, RejectConversationResponse } from '@workspace/api-zod';
import type { z } from 'zod';

export const getRejectConversationUrl = (id: number) => {
  return `/api/conversations/${id}/reject`;
};

export const rejectConversation = async (params: z.infer<typeof RejectConversationParams>): Promise<z.infer<typeof RejectConversationResponse>> => {
  return customFetch<z.infer<typeof RejectConversationResponse>>(getRejectConversationUrl(params.id), {
    method: 'POST',
    credentials: 'include',
  });
};

export const getRejectConversationKey = (id: number) => {
  return [`/api/conversations/${id}/reject`] as const;
};

export type RejectConversationMutationResult = NonNullable<Awaited<ReturnType<typeof rejectConversation>>>;
export type RejectConversationMutationError = ErrorType<unknown>;

export function useRejectConversation<
  TData = RejectConversationMutationResult,
  TError = RejectConversationMutationError
>() {
  const mutation = useMutation({
    mutationFn: rejectConversation,
  });
  return mutation;
}

// Helper types for the mutation
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type ErrorType<T> = T extends { error: unknown } ? Error : unknown;
type NonNullable<T> = T extends null | undefined ? never : T;