import { useLanguage } from '@/lib/i18n';
import { getLegalDoc } from '@/lib/legal-content';
import type { ReactNode } from 'react';
import { StaticPage } from '@/components/layout/static-page';

/** Privacy, terms and cookie pages: Italian text for Italian, English for the other languages. */
/** `children` is shown under the update date (e.g. the cookie preferences on the cookie page). */
export function LegalPage({ kind, children }: { kind: 'privacy' | 'terms' | 'cookies'; children?: ReactNode }) {
  const { language } = useLanguage();
  const doc = getLegalDoc(kind, language);
  return (
    <StaticPage eyebrow="" title={doc.title} intro={doc.intro}>
      <p className="text-sm font-bold text-sage">{doc.updated}</p>
      {children}
      {doc.sections.map((section) => (
        <section key={section.title} className="border-t border-line pt-6">
          <h2 className="text-lg font-black text-pine">{section.title}</h2>
          {section.paragraphs.map((text) => (
            <p key={text.slice(0, 40)} className="mt-2 text-[15px] leading-7 text-ink">
              {text}
            </p>
          ))}
          {section.list && (
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-ink marker:text-shutter">
              {section.list.map((item) => (
                <li key={item.slice(0, 40)}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </StaticPage>
  );
}

export default LegalPage;
