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
// Disable automatic session persistence to prevent XSS token theft.
// Use manual session management with sessionStorage (more secure than localStorage).
// Auto-refresh tokens to maintain session, but update our storage when refreshed.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Prevent automatic storage in localStorage/sessionStorage
    autoRefreshToken: true, // Keep auto-refresh enabled for better UX
    detectSessionInUrl: true,
  },
});

// Listen for session changes and update our sessionStorage
// This ensures that when tokens are auto-refreshed, we persist the new session
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    // Store the session in sessionStorage (more secure than localStorage)
    if (session) {
      window.sessionStorage.setItem('sb-session', JSON.stringify(session));
    }
  } else if (event === 'SIGNED_OUT') {
    // Clear session storage when user signs out
    window.sessionStorage.removeItem('sb-session');
  }
});
