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

/** Two tilted room cards floating gently in place (CSS: .hero-drift-a/b). */
export function HeroCards() {
  const { t } = useLanguage();
  const format = useFormat();

  return (
    <div className="relative h-[400px] w-[440px]" aria-hidden>
      {HERO_ROOMS.map((room, index) => {
        return (
          <div
            key={room.title}
            className={cn('absolute w-[320px]', index === 0 ? 'hero-drift-a left-0 top-6' : 'hero-drift-b right-0 top-16')}
          >
            <div className="rounded-2xl border border-pine/10 bg-paper p-3 shadow-float">
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
