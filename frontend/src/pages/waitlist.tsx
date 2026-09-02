import { Link } from 'wouter';
import {
  Sparkle,
  ShieldCheck,
  Zap,
  MessageCircle,
  Search,
  UserPlus,
  KeyRound,
  ArrowRight,
  MapPin,
  Wallet,
  Clock3,
} from 'lucide-react';
import { Button } from '@/components/shared/button';
import roomlyMark from '@assets/logo_no_background.png';
import { useEffect, useState } from 'react';

export function WaitlistPage() {
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  useEffect(() => {
    // Fetch the waitlist count from the API
    fetch('/api/waitlist/count')
      .then(response => response.json())
      .then(data => {
        setWaitlistCount(data.count);
      })
      .catch(error => {
        console.error('Failed to fetch waitlist count:', error);
        // Fallback to a reasonable number if API fails
        setWaitlistCount(1284);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#F1EFE8]">
      <div className="mx-auto max-w-[1040px] px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={roomlyMark} alt="Roomly" className="h-8 w-8 object-contain" />
            <span className="text-lg font-black tracking-[-0.03em] text-[#085041]">roomly</span>
          </div>
          <Link
            href="/register"
            className="hidden text-sm font-extrabold text-[#085041] hover:text-[#0F6E56] sm:block"
            data-testid="link-nav-register"
          >
            Crea un account
          </Link>
        </div>

        {/* Hero */}
        <section className="relative mt-2 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#E1F5EE] via-[#9FE1CB] to-[#7FD1AE] px-6 py-16 text-center sm:px-10 sm:py-20">
          <div className="pointer-events-none absolute -right-28 -top-32 h-[280px] w-[280px] rounded-full border border-[#08504124]" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-[180px] w-[180px] rounded-full bg-white/25" />

          <div className="relative z-10 mx-auto inline-flex items-center gap-2 rounded-full border border-[#08504129] bg-[#08504114] px-4 py-1.5 text-xs font-extrabold text-[#085041]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#EF9F27]" />
            Il modo più piacevole di trovare una stanza
          </div>

          <div className="relative z-10 mx-auto mt-7 flex h-[76px] w-[76px] items-center justify-center rounded-[20px] bg-white shadow-[0_14px_30px_rgba(8,80,65,0.1)]">
            <img src={roomlyMark} alt="" className="h-13 w-13 object-contain" />
          </div>

          <h1 className="relative z-10 mx-auto mt-7 max-w-lg text-4xl font-black leading-[1.1] text-[#085041] sm:text-5xl">
            Roomly sta arrivando
          </h1>
          <p className="relative z-10 mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-[#085041]/75">
            Stanze vere, proprietari verificati e conversazioni dirette. Crea il tuo account ora e
            sarai tra i primi ad avere accesso quando apriamo.
          </p>

          <div className="relative z-10 mt-8 flex justify-center">
            <Link href="/register">
              <button
                type="submit"
                aria-label="Registrati"
                title="Registrati"
                data-testid="button-search"
                className="h-12 min-w-[80px] shrink-0 rounded-xl bg-[#EF9F27] px-4 font-extrabold text-[#2C2C2A] transition-all duration-200 hover:bg-[#e6a53d] active:scale-[0.98]"
              >
                Registrati
              </button>
            </Link>
          </div>
          <p className="relative z-10 mt-3 text-xs text-[#085041]/60">
            Bastano 30 secondi. 
          </p>

          <div className="relative z-10 mt-6 inline-block rounded-full border border-[#08504129] bg-white/60 px-5 py-2 text-sm font-semibold text-[#085041]">
            <Sparkle size={14} className="mr-1.5 inline -translate-y-px" />
            <strong className="font-black">
              {waitlistCount !== null ? waitlistCount.toLocaleString() : '1.284'}
            </strong> studenti già registrati
          </div>
        </section>

        {/* Stats strip */}
        <section className="grid grid-cols-2 gap-4 py-10">
          <Stat value={waitlistCount !== null ? waitlistCount.toLocaleString() : '1.284'} label="Studenti in lista" />
          <Stat value="4,8/5" label="Valutazione media" />
        </section>

        {/* How it works */}
        <section className="py-6">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#0F6E56]">
              Come funziona
            </p>
            <h2 className="text-[28px] font-black text-[#2C2C2A] sm:text-[32px]">
              Da zero a chiavi in mano
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <StepCard
              icon={<UserPlus size={20} />}
              step="1"
              title="Crea il tuo profilo"
              text="Registrati con email in meno di un minuto e raccontaci cosa cerchi: zona, budget e stile di vita."
            />
            <StepCard
              icon={<Search size={20} />}
              step="2"
              title="Trova la stanza giusta"
              text="Filtra tra annunci verificati e scrivi direttamente al proprietario, senza intermediari."
            />
            <StepCard
              icon={<KeyRound size={20} />}
              step="3"
              title="Prenota e trasferisciti"
              text="Metti d'accordo i dettagli in chat e sei pronto per il trasloco, senza sorprese."
            />
          </div>
        </section>

        {/* Feature cards */}
        <section className="grid gap-5 py-14 sm:grid-cols-2">
          <FeatureCard
            icon={<ShieldCheck size={20} className="text-[#E1F5EE]" />}
            title="Proprietari verificati"
            text="Ogni annuncio ha un proprietario reale, verificato, con un prezzo chiaro e nessun dettaglio nascosto."
          />
          <FeatureCard
            icon={<MessageCircle size={20} className="text-[#E1F5EE]" />}
            title="Conversazioni dirette"
            text="Chatta con chi affitta davvero la stanza, senza intermediari e senza annunci anonimi."
          />
        </section>

        {/* What students look for */}
        <section className="py-6">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#0F6E56]">
              In anteprima
            </p>
            <h2 className="text-[28px] font-black text-[#2C2C2A] sm:text-[32px]">
              Cosa cercano gli studenti fuori sede
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <MiniPoint icon={<MapPin size={18} />} text="Vicino al campus o ai mezzi giusti" />
            <MiniPoint icon={<Wallet size={18} />} text="Prezzo chiaro, senza costi nascosti" />
            <MiniPoint icon={<Clock3 size={18} />} text="Risposta dal proprietario in tempi rapidi" />
          </div>
        </section>

        {/* Final CTA */}
        <section className="my-14 rounded-[28px] bg-[#085041] px-8 py-14 text-center sm:px-14">
          <h2 className="mx-auto max-w-md text-[28px] font-black leading-tight text-white sm:text-[32px]">
            Il tuo prossimo capitolo inizia con una chiave
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[#E1F5EE]/75">
            Crea il tuo account e sarai tra i primi ad accedere a Roomly quando apriamo.
          </p>
        </section>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[#0850411f] bg-white px-4 py-6 text-center">
      <div className="text-[28px] font-black text-[#085041] sm:text-[32px]">{value}</div>
      <div className="mt-1 text-xs font-semibold text-[#527067]">{label}</div>
    </div>
  );
}

function StepCard({
  icon,
  step,
  title,
  text,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#0850411a] bg-white p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E1F5EE] text-[#085041]">
          {icon}
        </div>
        <span className="text-xs font-black text-[#9fb3ab]">{step.padStart(2, '0')}</span>
      </div>
      <h3 className="mb-1.5 text-base font-black text-[#2C2C2A]">{title}</h3>
      <p className="text-sm leading-relaxed text-[#527067]">{text}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
  amber = false,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  amber?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] p-7 ${
        amber ? 'bg-[#EF9F27] text-[#2C2C2A]' : 'bg-[#085041] text-[#E1F5EE]'
      }`}
    >
      <div
        className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${
          amber ? 'bg-[#2C2C2A1a]' : 'bg-white/10'
        }`}
      >
        {icon}
      </div>
      <h3 className={`mb-2 text-lg font-black ${amber ? 'text-[#2C2C2A]' : 'text-white'}`}>
        {title}
      </h3>
      <p className={`text-sm leading-relaxed ${amber ? 'text-[#2C2C2A]/70' : 'text-[#E1F5EE]/70'}`}>
        {text}
      </p>
    </div>
  );
}

function MiniPoint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#0850411a] bg-white px-5 py-4">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#E1F5EE] text-[#085041]">
        {icon}
      </div>
      <p className="text-sm font-semibold text-[#2C2C2A]">{text}</p>
    </div>
  );
}

export default WaitlistPage;
