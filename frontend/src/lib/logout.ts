import type { QueryClient } from '@tanstack/react-query';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';
import { clearAuthSession } from '@/lib/auth-session';
import { clearRoleCache } from '@/lib/role-cache';
import { clearAccountCache } from '@/lib/account-cache';

// Logging out in one place (RMY-23), used by the profile menu and the
// profile page. Before, a failed /api/logout call skipped the local cleanup,
// and the React Query cache kept the previous user's data (chats, listings,
// contracts) in memory, where the next person on the same browser could see
// it until a reload.

/**
 * Forgets the user in this tab: the session (and its scheduled refresh), the
 * cached role and profile (memory and localStorage), and every API response
 * kept by React Query. Used on its own after an account deletion, where the
 * backend already cleared the cookies.
 */
export function endLocalSession(queryClient: QueryClient) {
  clearAuthSession();
  clearRoleCache();
  clearAccountCache();
  queryClient.clear();
}

/**
 * Asks the backend to end the session (revokes it and clears the HttpOnly
 * cookies), then always forgets the user locally, even if the request failed
 * (offline, server error): the page must never keep showing the old account.
 */
export async function logOut(queryClient: QueryClient) {
  try {
    await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.LOGOUT}`, { method: 'POST', credentials: 'include' });
  } catch {
    // Network error: nothing more to do here, the local cleanup below still runs.
  } finally {
    endLocalSession(queryClient);
  }
}
