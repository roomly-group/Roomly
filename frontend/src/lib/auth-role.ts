import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getRoleInflight, peekRoleCache, setRoleCache, setRoleInflight } from '@/lib/role-cache';
import { APP_ROUTES } from '@/lib/constants';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';

export type UserRole = 'admin' | 'user';

type RoleResponse = { role: UserRole; owner: boolean };

const DEFAULT_ROLE: RoleResponse = { role: 'user', owner: false };

// Una sola richiesta in volo alla volta; solo le risposte OK finiscono in cache
// (un errore momentaneo non deve "ricordare" che l'utente non è owner).
async function fetchRoleFromBackend(): Promise<RoleResponse | null> {
  try {
    const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_ROLE}`, {
      // No Authorization header needed - relying on HttpOnly cookie
      credentials: 'include',
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { role?: string; owner?: boolean };
    return {
      role: data.role === 'admin' ? 'admin' : 'user',
      owner: data.owner === true,
    };
  } catch {
    return null;
  }
}

async function fetchRole(user: User | null | undefined): Promise<RoleResponse> {
  if (!user) return DEFAULT_ROLE;

  // Cache fresca: niente getSession e niente rete.
  const fresh = peekRoleCache();
  if (fresh) return fresh;

  const pending = getRoleInflight();
  if (pending) return (await pending) ?? DEFAULT_ROLE;

  const { data } = await supabase.auth.getSession();
  if (!data.session) return DEFAULT_ROLE;

  const request = fetchRoleFromBackend().then((result) => {
    if (result) setRoleCache(result);
    setRoleInflight(null);
    return result;
  });
  setRoleInflight(request);
  return (await request) ?? DEFAULT_ROLE;
}

export async function getRoleInfo(user: User | null | undefined): Promise<RoleResponse> {
  return fetchRole(user);
}

export async function getUserRole(user: User | null | undefined): Promise<UserRole> {
  const { role } = await fetchRole(user);
  return role;
}

export async function getIsOwner(user: User | null | undefined): Promise<boolean> {
  const { owner } = await fetchRole(user);
  return owner;
}

/**
 * The signed-in user's main page, from the role already known (no request):
 * the home for admins and owners, the waitlist page for everyone else.
 */
export function mainPageFor(role: { role: UserRole; owner: boolean } | null): string {
  return role && (role.role === 'admin' || role.owner) ? APP_ROUTES.HOME : APP_ROUTES.WAITLIST_CONFIRMED;
}

export async function postAuthRoute(user: User | null | undefined): Promise<string> {
  const role = await getUserRole(user);
  // The onboarding forwards users who already finished it to WAITLIST_CONFIRMED.
  return role === 'admin' ? APP_ROUTES.HOME : APP_ROUTES.ONBOARDING;
}