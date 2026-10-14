import { useMutation } from '@tanstack/react-query';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';

export const deleteConversation = async (params: { id: number }): Promise<{ success: boolean }> =>
  customFetch<{ success: boolean }>(`/api/conversations/${params.id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

export function useDeleteConversation() {
  return useMutation({ mutationFn: deleteConversation });
}
