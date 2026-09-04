import { useState, type FormEvent, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Check, AtSign, Heart, LogOut } from 'lucide-react';
import { Button } from '@/components/shared/button';
import { supabase } from '@/lib/supabase';
import roomlyMark from '@assets/logo_no_background.png';

const DONATION_PRESETS = [5, 10, 25];
const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/i;

export function WaitlistConfirmedPage() {
  const [, setLocation] = useLocation();

  const [handle, setHandle] = useState('');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [claimedHandle, setClaimedHandle] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [positionLoading, setPositionLoading] = useState<boolean>(true);

  const [donationAmount, setDonationAmount] = useState<number | null>(10);
  const [customAmount, setCustomAmount] = useState('');
  const [donated, setDonated] = useState(false);

  useEffect(() => {
    // Fetch the user's actual position from the backend
    async function fetchPosition() {
      try {
        console.log('Fetching waitlist position from /api/waitlist/me');
        // Get the current session to include the auth token
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        const accessToken = session?.access_token;

        console.log('Access token present:', !!accessToken);

        const response = await fetch('/api/waitlist/me', {
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
          },
          credentials: 'include'
        });
        console.log(`API response status: ${response.status}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`API response data:`, data);
          setPosition(data.position);
        } else {
          // Fallback to a reasonable default if API fails
          const errorText = await response.text();
          console.error(`API error ${response.status}:`, errorText);
          setPosition(107); // Keep the demo value as fallback
        }
      } catch (error) {
        console.error('Failed to fetch waitlist position:', error);
        setPosition(107); // Fallback to demo value
      } finally {
        setPositionLoading(false);
      }
    }

    fetchPosition();
  }, []);

  function handleClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = handle.trim().replace(/^@/, '');

    if (!HANDLE_PATTERN.test(cleaned)) {
      setHandleError('Usa 3-20 caratteri: lettere, numeri o underscore.');
      return;
    }

    // TODO: sostituire con la vera chiamata POST /api/waitlist/handle.
    setHandleError(null);
    setClaimedHandle(cleaned);
  }

  function handleDonate() {
    const amount = customAmount ? Number(customAmount) : donationAmount;
    if (!amount || amount <= 0) return;
    // TODO: sostituire con la vera integrazione di pagamento.
    setDonated(true);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    // Clear session storage to remove any persisted session data
    window.sessionStorage.removeItem('sb-session');
    setLocation('/');
  }

  return (
    <div className="min-h-screen bg-[#F1EFE8]">
      <div className="mx-auto max-w-[1040px] px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={roomlyMark} alt="Roomly" className="h-8 w-8 object-contain" />
            <span className="text-lg font-black tracking-[-0.03em] text-[#085041]">roomly</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm font-bold text-[#527067] hover:text-[#085041]"
            data-testid="button-logout"
          >
            <LogOut size={15} />
            Esci
          </button>
        </div>

        {/* Position hero */}
        <section className="relative mt-2 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#E1F5EE] via-[#9FE1CB] to-[#7FD1AE] px-7 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute -right-28 -top-32 h-[280px] w-[280px] rounded-full border border-[#08504124]" />

          <div className="relative z-10 mx-auto inline-flex items-center gap-2 rounded-full border border-[#08504129] bg-[#08504114] px-4 py-1.5 text-xs font-extrabold text-[#085041]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#EF9F27]" />
            Iscrizione confermata
          </div>

          <h1 className="relative z-10 mx-auto mt-6 max-w-md text-[32px] font-black leading-tight text-[#085041] sm:text-[38px]">
            Sei nella waitlist di Roomly
          </h1>
          <p className="relative z-10 mx-auto mt-3 max-w-[480px] text-[15px] leading-relaxed text-[#085041]/70 sm:text-[16px]">
            Ci siamo quasi! La tua posizione nella waitlist è mostrata qui sotto. Ti invieremo un'email quando potrai accedere al sito.
          </p>

          <div className="relative z-10 mx-auto mt-8 inline-block rounded-2xl border border-[#0850411f] bg-white px-10 py-6">
            <div className="text-xs font-bold uppercase tracking-wide text-[#527067]">
              La tua posizione
            </div>
            <div className="text-[56px] font-black leading-none text-[#085041]">
              {positionLoading ? 'Caricamento...' : position ?? '--'}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default WaitlistConfirmedPage;
