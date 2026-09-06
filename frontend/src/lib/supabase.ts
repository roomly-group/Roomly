import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Make sure VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_PUBLISHABLE_KEY are set in your .env file.',
  );
}

// Single shared Supabase client for the whole auth.
// Security Implementation:
// 1. Disable automatic session persistence (persistSession: false) to prevent
//    automatic token storage in localStorage/sessionStorage by Supabase
// 2. Auto-refresh tokens to maintain session
// 3. Listen for auth state changes to update React state/context if needed
// 4. For persistent login across browser restarts, rely on HttpOnly cookie
//    set by backend /api/login endpoint
// 5. Content Security Policy (CSP) implemented in backend via helmet middleware
// 6. All user data rendered via React JSX which auto-escapes content to prevent XSS
//
// Note: Session persistence is now handled via HttpOnly cookie set by backend
// during login, rather than client-side localStorage storage.
// Token refresh is handled by calling the backend refresh endpoint when
// Supabase emits a TOKEN_REFRESHED event.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Prevent automatic storage in localStorage/sessionStorage
    autoRefreshToken: true, // Keep auto-refresh enabled for better UX
    detectSessionInUrl: true,
  },
});

// Listen for session changes and update our HttpOnly cookie via backend
// This ensures that when tokens are auto-refreshed by Supabase, we keep
// our cookie in sync with the fresh token
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
    const endpoint = event === 'SIGNED_IN' ? '/api/session' : '/api/refresh';
    const body = event === 'SIGNED_IN'
      ? JSON.stringify({ access_token: session.access_token })
      : undefined;

    await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body,
    }).catch((err) => console.error('Errore nel sincronizzare il cookie di sessione:', err));
  }
});
