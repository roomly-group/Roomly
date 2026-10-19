import { Link } from 'wouter';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES } from '@/lib/constants';
import { BrandBand } from '@/components/layout/auth-layout';
import { CityPlan } from '@/components/shared/city-plan';

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-[100dvh] flex-col bg-ground text-ink">
      <BrandBand />
      <main className="mx-auto grid w-full max-w-[1320px] flex-1 content-start gap-12 px-5 pb-20 pt-12 lg:grid-cols-12 lg:items-center lg:gap-8 lg:px-8 lg:pt-16">
        <div className="page-enter lg:col-span-5">
          <h1 className="display-heading text-[clamp(2.5rem,5vw,3.5rem)] text-pine">{t('notFound.title')}</h1>
          <p className="mt-4 max-w-md text-pretty text-[17px] leading-[1.55] text-pine-text">{t('notFound.text')}</p>
          <Link
            href={APP_ROUTES.HOME}
            className="mt-8 inline-flex min-h-12 items-center rounded-control bg-sun px-6 text-base font-extrabold text-ink transition-colors hover:bg-sun-hover"
          >
            {t('notFound.backHome')}
          </Link>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <CityPlan variant="lost" className="max-w-xl lg:max-w-none" />
        </div>
      </main>
    </div>
  );
}
