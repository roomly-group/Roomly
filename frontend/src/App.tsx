import { useScrollMotion } from '@/hooks/use-scroll-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router as WouterRouter } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PersonaLanguageProvider } from '@/components/layout/app-shell';
import { Router } from '@/router';
import { CookieConsentBanner } from '@/components/shared/cookie-consent';

// ===================== CONFIGURATION =====================

/** Number of times React Query retries a failed request before showing its error state. */
const QUERY_RETRY_COUNT = 1 as const;

// Retry once (not the default 3 times with backoff) so a failing API shows the
// error state quickly instead of leaving the loading skeleton on screen.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: QUERY_RETRY_COUNT, refetchOnWindowFocus: false } },
});

function App() {
  useScrollMotion();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <PersonaLanguageProvider>
            <Router />
            {/* Analytics consent: banner on public pages, GA only after "Accept". */}
            <CookieConsentBanner />
          </PersonaLanguageProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
