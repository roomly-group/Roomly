import { useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { Check, AtSign, Heart, LogOut } from 'lucide-react';
import { Button } from '@/components/shared/button';
import { supabase } from '@/lib/supabase';
import roomlyMark from '@assets/3-removebg-preview_1787501992159.png';

// Demo value — wire this up to a real `GET /api/waitlist/me` once the backend
// tracks signup order. For now every non-admin account sees the same spot.
const DEMO_POSITION = 107;
const DONATION_PRESETS = [5, 10, 25];
const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/i;

export function WaitlistConfirmedPage() {
  const [, setLocation] = useLocation();

  const [handle, setHandle] = useState('');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [claimedHandle, setClaimedHandle] = useState<string | null>(null);

  const [donationAmount, setDonationAmount] = useState<number | null>(10);
  const [customAmount, setCustomAmount] = useState('');
  const [donated, setDonated] = useState(false);

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
    setLocation('/login');
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
          <p className="relative z-10 mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[#085041]/70">
            Ti scriveremo appena si libera il tuo posto. Nel frattempo, ecco dove sei in classifica.
          </p>

          <div className="relative z-10 mx-auto mt-8 inline-block rounded-2xl border border-[#0850411f] bg-white px-10 py-6">
            <div className="text-xs font-bold uppercase tracking-wide text-[#527067]">
              La tua posizione
            </div>
            <div className="text-[56px] font-black leading-none text-[#085041]">
              {DEMO_POSITION}
            </div>
          </div>
        </section>

        <section className="grid gap-5 py-10 sm:grid-cols-2">
          {/* Claim handle */}
          <div className="rounded-[20px] border border-[#0850411a] bg-white p-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E1F5EE] text-[#085041]">
              <AtSign size={20} />
            </div>
            <h2 className="mb-1.5 text-lg font-black text-[#2C2C2A]">Claima il tuo handle</h2>
            <p className="mb-5 text-sm leading-relaxed text-[#527067]">
              Riservati il tuo nome utente su Roomly prima che lo prenda qualcun altro.
            </p>

            {claimedHandle ? (
              <div
                className="flex items-center gap-2.5 rounded-xl border border-[#0F6E5633] bg-[#E1F5EE] px-4 py-3 text-sm font-bold text-[#085041]"
                data-testid="text-handle-claimed"
              >
                <Check size={16} />
                @{claimedHandle} è tuo
              </div>
            ) : (
              <form onSubmit={handleClaim} className="flex flex-col gap-2" data-testid="form-claim-handle">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#9fb3ab]">
                      @
                    </span>
                    <input
                      value={handle}
                      onChange={(event) => setHandle(event.target.value)}
                      placeholder="tuonome"
                      className="h-[46px] w-full rounded-full border border-[#0850411f] bg-[#F1EFE8] pl-8 pr-4 text-sm text-[#2C2C2A] outline-none focus:border-[#0F6E56]"
                      data-testid="input-handle"
                    />
                  </div>
                  <Button type="submit" variant="primary" className="h-[46px] rounded-full px-5">
                    Claima
                  </Button>
                </div>
                {handleError ? (
                  <p className="text-xs font-semibold text-red-600" role="alert">
                    {handleError}
                  </p>
                ) : null}
              </form>
            )}
          </div>

          {/* Donate */}
          <div className="rounded-[20px] border border-[#0850411a] bg-white p-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FDEBD1] text-[#EF9F27]">
              <Heart size={20} />
            </div>
            <h2 className="mb-1.5 text-lg font-black text-[#2C2C2A]">Sostieni Roomly</h2>
            <p className="mb-5 text-sm leading-relaxed text-[#527067]">
              Aiutaci ad aprire prima: chi dona salta automaticamente 20 posizioni in lista.
            </p>

            {donated ? (
              <div
                className="flex items-center gap-2.5 rounded-xl border border-[#EF9F2755] bg-[#FDEBD1] px-4 py-3 text-sm font-bold text-[#8a5a0c]"
                data-testid="text-donation-thanks"
              >
                <Check size={16} />
                Grazie per il supporto!
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  {DONATION_PRESETS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => {
                        setDonationAmount(amount);
                        setCustomAmount('');
                      }}
                      data-testid={`button-donate-${amount}`}
                      className={`h-11 flex-1 rounded-full border text-sm font-extrabold transition-colors ${
                        donationAmount === amount && !customAmount
                          ? 'border-[#EF9F27] bg-[#EF9F27] text-[#2C2C2A]'
                          : 'border-[#0850411f] bg-[#F1EFE8] text-[#527067] hover:border-[#EF9F27]'
                      }`}
                    >
                      €{amount}
                    </button>
                  ))}
                </div>
                <input
                  value={customAmount}
                  onChange={(event) => {
                    setCustomAmount(event.target.value.replace(/[^0-9]/g, ''));
                    setDonationAmount(null);
                  }}
                  placeholder="Altro importo (€)"
                  className="h-[46px] w-full rounded-full border border-[#0850411f] bg-[#F1EFE8] px-4.5 text-sm text-[#2C2C2A] outline-none focus:border-[#EF9F27]"
                  data-testid="input-custom-amount"
                />
                <Button
                  type="button"
                  variant="amber"
                  onClick={handleDonate}
                  className="h-[46px] justify-center rounded-full"
                  data-testid="button-donate-submit"
                >
                  Dona ora
                </Button>
              </div>
            )}
          </div>
        </section>

        <p className="py-8 text-center text-xs text-[#527067]">
          Questa non è un'offerta reale. Pagina dimostrativa per la waitlist di Roomly.
        </p>
      </div>
    </div>
  );
}

export default WaitlistConfirmedPage;
