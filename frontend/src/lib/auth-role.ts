import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'admin' | 'user';

type RoleResponse = { role: UserRole; owner: boolean };

async function fetchRoleFromBackend(accessToken: string): Promise<RoleResponse> {
  try {
    const response = await fetch('/api/me/role', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return { role: 'user', owner: false };
    }

    const data = (await response.json()) as { role?: string; owner?: boolean };
    return {
      role: data.role === 'admin' ? 'admin' : 'user',
      owner: data.owner === true,
    };
  } catch {
    return { role: 'user', owner: false };
  }
}

async function fetchRole(user: User | null | undefined): Promise<RoleResponse> {
  if (!user) return { role: 'user', owner: false };

  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) return { role: 'user', owner: false };

  return fetchRoleFromBackend(accessToken);
}

export async function getUserRole(user: User | null | undefined): Promise<UserRole> {
  const { role } = await fetchRole(user);
  return role;
}

export async function getIsOwner(user: User | null | undefined): Promise<boolean> {
  const { owner } = await fetchRole(user);
  return owner;
}

export async function postAuthRoute(user: User | null | undefined): Promise<string> {
  const role = await getUserRole(user);
  return role === 'admin' ? '/home' : '/waitlist/confirmed';
}