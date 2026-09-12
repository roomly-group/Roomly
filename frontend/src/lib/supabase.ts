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

// Keep our HttpOnly cookies in sync with whatever session the Supabase
// client currently holds:
// - TOKEN_REFRESHED: Supabase auto-refreshed the access token in memory;
//   push both fresh tokens back into the backend's cookies.
// - SIGNED_IN: fires after supabase.auth.signUp() with an immediate
//   session, and after detectSessionInUrl parses an email-confirmation
//   redirect. Neither of those goes through /api/login, so without this
//   the backend would never receive a session cookie at all.
// Both cases require refresh_token as well as access_token — the backend
// needs it to keep the refresh cookie in sync so setSession() keeps working
// after future reloads.
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
    const endpoint = event === 'SIGNED_IN' ? '/api/session' : '/api/refresh';

    await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'roomly'
      },
      body: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
    }).catch((err) => console.error('Errore nel sincronizzare il cookie di sessione:', err));
  }
});
