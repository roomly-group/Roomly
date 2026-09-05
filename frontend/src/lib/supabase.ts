import { createClient } from '@supabase/supabase-js';
import { storage } from './storage';

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
// 2. Use manual session management with localStorage (persists across tabs/windows)
// 3. Auto-refresh tokens to maintain session, but update our storage when refreshed
// 4. Listen for auth state changes to manually handle session persistence
// 5. Restore session from localStorage on app startup (in main.tsx)
// 6. Content Security Policy (CSP) implemented in backend via helmet middleware
// 7. All user data rendered via React JSX which auto-escapes content to prevent XSS
//
// Note: For maximum security, consider migrating to HTTP-only cookies for token
// storage (long-term architectural change).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Prevent automatic storage in localStorage/sessionStorage
    autoRefreshToken: true, // Keep auto-refresh enabled for better UX
    detectSessionInUrl: true,
  },
});

// Listen for session changes and update our localStorage
// This ensures that when tokens are auto-refreshed, we persist the new session
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    // Store the session in localStorage (persists across tabs/windows)
    if (session) {
      storage.set('sb-session', JSON.stringify(session));
    }
  } else if (event === 'SIGNED_OUT') {
    // Clear localStorage when user signs out
    storage.remove('sb-session');
  }
});
