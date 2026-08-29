import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Role check happens server-side now: the backend reads the boolean
// `admin` column on `utenti` using the Supabase service-role key (which
// bypasses RLS), so the browser never queries `utenti` directly and never
// has a way to see or infer another user's admin flag.
// Every normal sign-up defaults to admin = false and lands on the waitlist
// page instead of the full site.
export type UserRole = 'admin' | 'user';

async function fetchRoleFromBackend(accessToken: string): Promise<UserRole> {
  try {
    const response = await fetch('/api/me/role', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      // Expired/invalid token, backend down, etc.: fail safe as a normal user.
      return 'user';
    }

    const data = (await response.json()) as { role?: string };
    return data.role === 'admin' ? 'admin' : 'user';
  } catch {
    // Network error: fail safe as a normal user.
    return 'user';
  }
}

export async function getUserRole(user: User | null | undefined): Promise<UserRole> {
  if (!user) return 'user';

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return 'user';

  return fetchRoleFromBackend(accessToken);
}

// Where a signed-in user should land right after login/registration.
export async function postAuthRoute(user: User | null | undefined): Promise<string> {
  const role = await getUserRole(user);
  return role === 'admin' ? '/home' : '/waitlist/confirmed';
}
