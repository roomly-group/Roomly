import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import {
  API_BASE_PATH,
  API_ROUTE_PATHS,
  type CreateOwnerContractInput,
  type OwnerContractsList,
  type UpdateOwnerContractStatusInput,
} from '@workspace/api-zod';

export const getOwnerContractsUrl = () => `${API_BASE_PATH}${API_ROUTE_PATHS.OWNER_CONTRACTS}`;

/** Plain link: the browser downloads the CSV with the session cookie. */
export const ownerContractsExportUrl = `${API_BASE_PATH}${API_ROUTE_PATHS.OWNER_CONTRACTS_EXPORT}`;

export const getOwnerContractsQueryKey = () => [getOwnerContractsUrl()] as const;

export function useOwnerContracts() {
  return useQuery({
    queryKey: getOwnerContractsQueryKey(),
    queryFn: () => customFetch<OwnerContractsList>(getOwnerContractsUrl(), { method: 'GET', credentials: 'include' }),
  });
}

/** Creates a draft contract from an accepted request, then refreshes the list. */
export function useCreateOwnerContract() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOwnerContractInput) =>
      customFetch<{ id: number }>(getOwnerContractsUrl(), {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(input),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: getOwnerContractsQueryKey() }),
  });
}

/** Moves a contract to its next step (send, signed, registered, ended, cancelled). */
export function useUpdateOwnerContractStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateOwnerContractStatusInput & { id: number }) =>
      customFetch<{ success: boolean }>(
        `${API_BASE_PATH}${API_ROUTE_PATHS.OWNER_CONTRACT_STATUS.replace(':id', String(id))}`,
        { method: 'POST', credentials: 'include', body: JSON.stringify(input) },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: getOwnerContractsQueryKey() }),
  });
}
