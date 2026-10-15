import { useMutation } from '@tanstack/react-query';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';

export const deleteConversation = async (params: { id: number }): Promise<{ success: boolean }> =>
  customFetch<{ success: boolean }>(`${API_BASE_PATH}${API_ROUTE_PATHS.CONVERSATION_DELETE.replace(':id', String(params.id))}`, {
    method: 'DELETE',
    credentials: 'include',
  });

export function useDeleteConversation() {
  return useMutation({ mutationFn: deleteConversation });
}
