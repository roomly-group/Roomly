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
    <div className="flex min-h-[100dvh] flex-col bg-cream text-ink">
      <header className="mx-auto flex h-20 w-full max-w-[1120px] items-center px-5 lg:px-8">
        <div className="w-full">
          <Navbar />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-16 lg:px-8">
        <section className="pt-6 sm:pt-10">
          <h1 className="display-heading max-w-2xl text-[clamp(2.25rem,5vw,2.75rem)] text-pine">{title}</h1>
          {intro && <p className="mt-4 max-w-xl text-[17px] leading-7 text-pine-text">{intro}</p>}

          <div className="prose-roomly mt-10 max-w-2xl space-y-8">{children}</div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default StaticPage;
