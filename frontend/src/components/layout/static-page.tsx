import { SiteFooter } from '@/components/layout/site-footer';
import { Navbar } from '@/components/layout/navbar';
import { useLanguage } from '@/lib/i18n';

/**
 * Reading pages (about, contact, legal): pine band, a left-aligned title and
 * lede, text at reading measure on the left seven columns and an optional
 * aside on the right (a section index on legal pages, related content elsewhere).
 */
export function StaticPage({
  title,
  intro,
  aside,
  children,
}: {
  title: string;
  intro?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-ground text-ink">
      <header className="bg-pine">
        <div className="mx-auto flex h-[72px] w-full max-w-[1320px] items-center px-5 lg:px-8">
          <div className="w-full">
            <Navbar />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-5 pb-20 pt-12 lg:px-8 lg:pt-16">
        <div className="max-w-[46rem]">
          <h1 className="display-heading text-[clamp(2.5rem,5vw,3.5rem)] text-pine">{title}</h1>
          {intro && <p className="mt-5 text-[19px] leading-[1.55] text-pine-text">{intro}</p>}
        </div>
        <div className="mt-12 grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="prose-roomly min-w-0 max-w-[38rem] space-y-10 lg:col-span-7">{children}</div>
          {aside && (
            <aside className="lg:col-span-4 lg:col-start-9">
              <div className="lg:sticky lg:top-8">{aside}</div>
            </aside>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export type LegalSectionItem = { id: string; title: string; text: string };

/** One numbered clause of a legal page, addressable from the section index. */
export function LegalSection({ id, title, text }: LegalSectionItem) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8 border-t border-line pt-6">
      <h2 id={`${id}-title`} className="text-xl font-black tracking-[-0.02em] text-pine">
        {title}
      </h2>
      <p className="mt-2 text-base leading-7 text-ink">{text}</p>
    </section>
  );
}

/** The clause titles as anchor links; shown beside the text from 1024px, where the page is long enough to need it. */
export function LegalIndex({ sections }: { sections: LegalSectionItem[] }) {
  const { t } = useLanguage();
  return (
    <nav aria-labelledby="legal-index-title" className="hidden border-t-[3px] border-pine pt-4 lg:block">
      <p id="legal-index-title" className="text-[13px] font-extrabold text-pine">
        {t('staticPage.onThisPage')}
      </p>
      <ul className="mt-2">
        {sections.map((section) => (
          <li key={section.id} className="border-b border-line">
            <a
              href={`#${section.id}`}
              className="flex min-h-10 items-center py-1.5 text-[15px] font-bold text-ink transition-colors hover:text-shutter hover:underline hover:underline-offset-4"
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default StaticPage;
