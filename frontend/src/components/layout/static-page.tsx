import { SiteFooter } from '@/components/layout/site-footer';
import { Navbar } from '@/components/layout/navbar';

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
  return (
    <div className="min-h-screen bg-[#F1EFE8]">
      <div className="mx-auto max-w-[1040px] px-6 py-6">
        <Navbar />

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
