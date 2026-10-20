import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { useLanguage } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-selector';
import { APP_ROUTES } from '@/lib/constants';
import roomlyMark from '@assets/logo_no_background.png';

/** Login / register: the form on the left, what Roomly does on a pine panel on the right (desktop). */
export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const facts = [
    { title: t('waitlist.step1Title'), text: t('waitlist.step1Text') },
    { title: t('waitlist.step2Title'), text: t('waitlist.step2Text') },
    { title: t('waitlist.step3Title'), text: t('waitlist.step3Text') },
  ];

  return (
    <div className="grid min-h-screen bg-cream lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link href={APP_ROUTES.ROOT} className="flex items-center gap-2" aria-label="Roomly">
            <img src={roomlyMark} alt="" className="h-9 w-9 object-contain" />
            <span className="text-xl font-black tracking-[-0.05em] text-pine">roomly</span>
          </Link>
          <LanguagePicker />
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <h1 className="text-[2rem] font-black leading-tight tracking-[-0.03em] text-pine">{title}</h1>
          <p className="mt-2 text-[15px] leading-6 text-sage">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 border-t border-line pt-6 text-sm text-sage">{footer}</div>
        </div>
      </div>

      <aside className="hidden flex-col justify-center bg-pine p-12 text-mint-mist lg:flex">
        <p className="max-w-sm text-[2rem] font-black leading-tight tracking-[-0.03em]">{t('home.title1')} {t('home.title2')}</p>
        <dl className="mt-10 space-y-6 border-t border-mint-mist/15 pt-8">
          {facts.map((fact, index) => (
            <div key={fact.title} className="grid grid-cols-[2.25rem_1fr] gap-x-3">
              <span className="row-span-2 grid h-9 w-9 place-items-center rounded-full bg-mint-mist text-sm font-black text-pine" aria-hidden>
                {index + 1}
              </span>
              <dt className="font-extrabold">{fact.title}</dt>
              <dd className="mt-1 max-w-sm text-sm leading-6 text-mint-wash">{fact.text}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
