import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { supabase } from '@/lib/supabase';
import './index.css';

async function initializeApp() {
  try {
    // Check if we have a valid session cookie and restore Supabase session
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const { session } = await response.json();
      if (session) {
        await supabase.auth.setSession(session);
      }
    }
    // If not ok or no session, supabase.auth.getSession() will return null
    // which is fine - auth checks will handle this appropriately
  } catch (error) {
    console.error('Failed to initialize app session:', error);
    // Continue anyway - auth checks will handle unauthenticated state
  }
}

initializeApp().finally(() => {
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