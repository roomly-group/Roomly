import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { consumeAuthRedirect, getAuthSession, restoreSession } from '@/lib/auth-session';
import { APP_ROUTES, AUTH_LINK_FAILED_QUERY, WAITLIST_FAQ_ANCHOR_URL } from '@/lib/constants';
import { clearRoleCache } from '@/lib/role-cache';
import { clearAccountCache } from '@/lib/account-cache';
import { rememberInviteFromUrl } from '@/lib/onboarding';
import './index.css';

async function initializeApp() {
  try {
    // Back from Google or an email link (`?code=`): the backend turned the
    // code into session cookies, so the user is logged in.
    const redirect = await consumeAuthRedirect();
    if (redirect === 'signed_in') return getAuthSession();

    // Otherwise read the session from the HttpOnly cookies, if any.
    const session = await restoreSession();
    // The link could not log them in (other browser, expired, already used):
    // show the login page, which explains it in plain words.
    if (!session && redirect === 'failed') {
      window.history.replaceState(null, '', `${APP_ROUTES.LOGIN}?${AUTH_LINK_FAILED_QUERY}`);
    }
    return session;
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
  // The footer "FAQ" link ("/#faq") is a full page load: logged-in users who
  // clicked it want to read the FAQ, so they are not sent away.
  const isFaqLink = `${window.location.pathname}${window.location.hash}` === WAITLIST_FAQ_ANCHOR_URL;
  // Logged in and on a public entry page: go to the onboarding, which sends
  // users who already finished it on to the waitlist confirmation page.
  if (!isFaqLink && LOGGED_OUT_ONLY_PATHS.includes(window.location.pathname)) {
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