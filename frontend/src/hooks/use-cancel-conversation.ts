import { useMutation } from '@tanstack/react-query';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import { CancelConversationParams, CancelConversationResponse, API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';
import type { z } from 'zod';

export const getCancelConversationUrl = (id: number) => {
  return `${API_BASE_PATH}${API_ROUTE_PATHS.CONVERSATIONS}/${id}/cancel`;
};

export const cancelConversation = async (params: z.infer<typeof CancelConversationParams>): Promise<z.infer<typeof CancelConversationResponse>> => {
  return customFetch<z.infer<typeof CancelConversationResponse>>(getCancelConversationUrl(params.id), {
    method: 'POST',
    credentials: 'include',
  });
};

export const getCancelConversationKey = (id: number) => {
  return [getCancelConversationUrl(id)] as const;
};

export type CancelConversationMutationResult = NonNullable<Awaited<ReturnType<typeof cancelConversation>>>;
export type CancelConversationMutationError = ErrorType<unknown>;

export function useCancelConversation<
  TData = CancelConversationMutationResult,
  TError = CancelConversationMutationError
>() {
  const mutation = useMutation({
    mutationFn: cancelConversation,
  });
  return mutation;
}

// Helper types for the mutation
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type ErrorType<T> = T extends { error: unknown } ? Error : unknown;
type NonNullable<T> = T extends null | undefined ? never : T;