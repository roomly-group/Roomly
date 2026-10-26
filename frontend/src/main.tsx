import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { supabase, urlSessionSynced } from '@/lib/supabase';
import { APP_ROUTES } from '@/lib/constants';
import { clearRoleCache } from '@/lib/role-cache';
import { clearAccountCache } from '@/lib/account-cache';
import { rememberInviteFromUrl } from '@/lib/onboarding';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';
import './index.css';

async function initializeApp() {
  try {
    // Back from Google or the confirmation email: the session came in the
    // URL and is now in our cookies too, so the user is logged in.
    if (await urlSessionSynced) {
      const { data } = await supabase.auth.getSession();
      if (data.session) return data.session;
    }

    // Check if we have a valid session cookie and restore Supabase session
    const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.VERIFY}`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const { session } = await response.json();
      if (session) {
        await supabase.auth.setSession(session);
        return session;
      }
    }
    // If not ok or no session, supabase.auth.getSession() will return null
    // which is fine - auth checks will handle this appropriately
    return null;
  } catch (error) {
    console.error('Failed to initialize app session:', error);
    // Continue anyway - auth checks will handle unauthenticated state
    return null;
  }
}

// Public entry pages a logged-in user is sent away from on load. Every other
// route is left alone: redirecting all of them sent any reload (or any full
// page navigation) of /home, /owner, /listings/... to the waitlist.
const LOGGED_OUT_ONLY_PATHS: readonly string[] = [
  APP_ROUTES.ROOT,
  APP_ROUTES.WAITLIST,
  APP_ROUTES.LOGIN,
  APP_ROUTES.REGISTER,
];

// Someone opened a friend's invite link: keep the code until they have an account.
rememberInviteFromUrl();

initializeApp().then((session) => {
  if (!session) {
    // No valid session: role/profile saved by a previous session must not be shown.
    clearRoleCache();
    clearAccountCache();
    return;
  }
  // Logged in and on a public entry page: go to the onboarding, which sends
  // users who already finished it on to the waitlist confirmation page.
  if (LOGGED_OUT_ONLY_PATHS.includes(window.location.pathname)) {
    window.location.href = APP_ROUTES.ONBOARDING;
  }
}).finally(() => {
  createRoot(document.getElementById('root')!, {
    onCaughtError: (error, errorInfo) => {
      console.error(error, errorInfo.componentStack);
    },
  }).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
});