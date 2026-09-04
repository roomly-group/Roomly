import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { supabase } from '@/lib/supabase';
import './index.css';

// Il client Supabase ha persistSession: false, quindi non ripristina la
// sessione da solo. La recuperiamo a mano da sessionStorage (dove viene
// salvata da onAuthStateChange in lib/supabase.ts) prima di renderizzare.
async function restoreSession() {
  const stored = window.sessionStorage.getItem('sb-session');
  if (!stored) return;

  try {
    const session = JSON.parse(stored);
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch (error) {
    console.error('Failed to restore session:', error);
    window.sessionStorage.removeItem('sb-session');
  }
}

restoreSession().finally(() => {
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