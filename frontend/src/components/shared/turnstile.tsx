import { useEffect, useId, useRef } from 'react';

// Minimal typings for the bits of the global `turnstile` object we use.
// The actual script is loaded from Cloudflare at runtime (see loadTurnstileScript below).
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
let scriptLoadPromise: Promise<void> | null = null;

// Cloudflare's api.js is safe to load once and share across every widget
// instance on the page; loading it twice throws. Cache the loading promise
// so concurrent mounts (or remounts) all await the same load.
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Turnstile script'));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

// Renders a Cloudflare Turnstile challenge. Calls onVerify(token) once the
// visitor passes the challenge; that token must be sent to the backend and
// forwarded to Supabase's signUp() as options.captchaToken - Supabase (not
// this component) is what actually verifies it server-side against the
// Turnstile secret key configured in the Supabase dashboard.
export function TurnstileWidget({ onVerify, onExpire, onError }: TurnstileWidgetProps) {
  const containerId = `turnstile-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  useEffect(() => {
    if (!siteKey) {
      console.error(
        'VITE_TURNSTILE_SITE_KEY is not set - the signup CAPTCHA cannot render. ' +
          'Set it in the frontend .env file.',
      );
      return;
    }

    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        const el = document.getElementById(containerId);
        if (!el) return;
        widgetIdRef.current = window.turnstile.render(el, {
          sitekey: siteKey,
          callback: onVerify,
          'expired-callback': onExpire,
          'error-callback': onError,
          theme: 'light',
        });
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, siteKey]);

  if (!siteKey) return null;

  return <div id={containerId} data-testid="turnstile-widget" />;
}
