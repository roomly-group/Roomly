import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Rooms shown in the home hero; they take turns in front. */
const HERO_ROOMS: { photo: string; title: TranslationKey; price: number; km: number }[] = [
  {
    photo: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=720&q=70',
    title: 'home.heroExampleTitle',
    price: 420,
    km: 0.8,
  },
  {
    photo: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=720&q=70',
    title: 'home.heroExampleTitle2',
    price: 380,
    km: 1.2,
  },
];
/** How long a card stays in front before the other one comes forward (ms). */
const SWAP_INTERVAL_MS = 3800 as const;

/** Two floating room cards, tilted opposite ways, that swap front and back on a timer. */
export function HeroCards() {
  const { t } = useLanguage();
  const format = useFormat();
  const [front, setFront] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setFront((current) => (current + 1) % HERO_ROOMS.length), SWAP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative h-[400px] w-[440px]" aria-hidden>
      {HERO_ROOMS.map((room, index) => {
        const isFront = index === front;
        return (
          <div
            key={room.title}
            className={cn(
              'absolute w-[320px] transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)]',
              index === 0 ? 'left-0 top-6' : 'right-0 top-16',
              isFront ? 'z-20 scale-100 opacity-100' : 'z-10 scale-[0.92] opacity-80',
              index === 0 ? 'rotate-[-6deg]' : 'rotate-[7deg]',
            )}
          >
            <div
              className="floaty rounded-2xl border border-pine/10 bg-paper p-3 shadow-float"
              style={{ animationDelay: `${index * -2.5}s` }}
            >
              <img src={room.photo} alt="" loading="eager" className="aspect-[4/3] w-full rounded-xl bg-mint-mist object-cover" />
              <div className="px-2 pb-1 pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[15px] font-black text-pine">{t(room.title)}</p>
                  <p className="shrink-0 text-[15px] font-black tabular-nums text-shutter">
                    {format.price(room.price)}
                    <span className="text-xs font-bold text-sage">{t('common.perMonth')}</span>
                  </p>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-sage">
                  <GraduationCap size={15} className="shrink-0 text-shutter" />
                  {t('waitlist.exampleDistance').replace('{km}', format.km(room.km))}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default HeroCards;
