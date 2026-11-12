import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getListConversationsQueryKey } from '@workspace/api-client-react';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import {
  API_BASE_PATH,
  API_ROUTE_PATHS,
  type AdminReportMessages,
  type AdminReportsList,
  type CreateReportInput,
  type ReportStatus,
  type ResolveReportInput,
} from '@workspace/api-zod';

// Calls for the safety tools (audit finding RMY-12). Backend: routes/safety.ts.
// Users: report, block, unblock. Admins: report queue, reported chat, actions.

// ===================== CONFIGURATION =====================

const reportsUrl = `${API_BASE_PATH}${API_ROUTE_PATHS.REPORTS}`;
const adminReportsUrl = `${API_BASE_PATH}${API_ROUTE_PATHS.ADMIN_REPORTS}`;
/** Every admin report query starts with this key, so one invalidation refreshes them all. */
const ADMIN_REPORTS_KEY = [adminReportsUrl] as const;

const blockUrl = (conversationId: number) =>
  `${API_BASE_PATH}${API_ROUTE_PATHS.CONVERSATION_BLOCK.replace(':id', String(conversationId))}`;

const postJson = <T,>(url: string, body: unknown) =>
  customFetch<T>(url, { method: 'POST', credentials: 'include', body: JSON.stringify(body) });

// ===================== USERS =====================

/** Files a report (a chat partner, a message or a listing). */
export function useCreateReport() {
  return useMutation({
    mutationFn: (input: CreateReportInput) => postJson<{ success: boolean }>(reportsUrl, input),
  });
}

/** Blocks (`blocked: true`) or unblocks the other person of a chat, then refreshes the inbox. */
export function useSetBlocked() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, blocked }: { conversationId: number; blocked: boolean }) =>
      customFetch<{ success: boolean }>(blockUrl(conversationId), {
        method: blocked ? 'POST' : 'DELETE',
        credentials: 'include',
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: getListConversationsQueryKey() }),
  });
}

// ===================== ADMINS =====================

/** Reports with the given status (open ones oldest first). */
export function useAdminReports(status: ReportStatus, enabled = true) {
  return useQuery({
    queryKey: [...ADMIN_REPORTS_KEY, status],
    queryFn: () => customFetch<AdminReportsList>(`${adminReportsUrl}?status=${status}`, { method: 'GET', credentials: 'include' }),
    enabled,
  });
}

/** The chat a report came from; fetched only when the admin asks to read it. */
export function useAdminReportMessages(reportId: number, enabled: boolean) {
  return useQuery({
    queryKey: [...ADMIN_REPORTS_KEY, 'messages', reportId],
    queryFn: () =>
      customFetch<AdminReportMessages>(
        `${API_BASE_PATH}${API_ROUTE_PATHS.ADMIN_REPORT_MESSAGES.replace(':id', String(reportId))}`,
        { method: 'GET', credentials: 'include' },
      ),
    enabled,
    // Admin data: never keep a reported chat around after the page is left.
    gcTime: 0,
  });
}

/** The three admin actions. Each one refreshes the report lists afterwards. */
export function useAdminReportActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ADMIN_REPORTS_KEY });

  const resolve = useMutation({
    mutationFn: ({ id, ...input }: ResolveReportInput & { id: number }) =>
      postJson<{ success: boolean }>(`${API_BASE_PATH}${API_ROUTE_PATHS.ADMIN_REPORT_RESOLVE.replace(':id', String(id))}`, input),
    onSuccess: refresh,
  });
  const setUserSuspended = useMutation({
    mutationFn: ({ userId, suspended }: { userId: string; suspended: boolean }) =>
      postJson<{ success: boolean }>(
        `${API_BASE_PATH}${API_ROUTE_PATHS.ADMIN_USER_STATUS.replace(':id', encodeURIComponent(userId))}`,
        { suspended },
      ),
    onSuccess: refresh,
  });
  const setListingActive = useMutation({
    mutationFn: ({ listingId, active }: { listingId: number; active: boolean }) =>
      postJson<{ success: boolean }>(
        `${API_BASE_PATH}${API_ROUTE_PATHS.ADMIN_LISTING_VISIBILITY.replace(':id', String(listingId))}`,
        { active },
      ),
    onSuccess: refresh,
  });

  return { resolve, setUserSuspended, setListingActive };
}
