import { useQuery } from '@tanstack/react-query';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import { API_BASE_PATH, API_ROUTE_PATHS, type StudentContractOverview } from '@workspace/api-zod';

// Student side of contracts ("Il mio contratto", pages/student-contract.tsx):
// read-only, the backend returns only the signed-in student's own rows.

export const getStudentContractUrl = () => `${API_BASE_PATH}${API_ROUTE_PATHS.ME_CONTRACT}`;

export const getStudentContractQueryKey = () => [getStudentContractUrl()] as const;

export function useStudentContract() {
  return useQuery({
    queryKey: getStudentContractQueryKey(),
    queryFn: () => customFetch<StudentContractOverview>(getStudentContractUrl(), { method: 'GET', credentials: 'include' }),
  });
}
