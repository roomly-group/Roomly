import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { supabase } from '@/lib/supabase';

import './index.css';

// Restore session from sessionStorage on app startup to reduce XSS risk
// sessionStorage is more secure than localStorage (tab-scoped)
const restoreSession = async () => {
  try {
    const sessionString = window.sessionStorage.getItem('sb-session');
    if (sessionString) {
      const session = JSON.parse(sessionString);
      await supabase.auth.setSession(session);
    }
  } catch (error) {
    console.error('Failed to restore session:', error);
    // Clear corrupted session data
    window.sessionStorage.removeItem('sb-session');
  }
};

// Initialize session restoration
restoreSession();

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
