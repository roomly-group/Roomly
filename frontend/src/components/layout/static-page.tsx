import { Link } from 'wouter';
import roomlyMark from '@assets/logo_no_background.png';
import { SiteFooter } from '@/components/layout/site-footer';
import { useLanguage } from '@/lib/i18n';

export function StaticPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#F1EFE8]">
      <div className="mx-auto max-w-[1040px] px-6 py-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo">
            <img src={roomlyMark} alt="Roomly" className="h-8 w-8 object-contain" />
            <span className="text-lg font-black tracking-[-0.03em] text-[#085041]">roomly</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-extrabold text-[#085041] hover:text-[#0F6E56]"
          >
            {t('searchPage.backHome')}
          </Link>
        </div>

        <section className="mt-2 rounded-[28px] bg-white px-6 py-14 sm:px-12 sm:py-16">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#0F6E56]">
            {eyebrow}
          </p>
          <h1 className="max-w-2xl text-[32px] font-black leading-[1.1] text-[#085041] sm:text-4xl">
            {title}
          </h1>
          {intro && (
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-[#085041]/75">
              {intro}
            </p>
          )}

          <div className="prose-roomly mt-10 max-w-2xl space-y-8">{children}</div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}

export default StaticPage;
