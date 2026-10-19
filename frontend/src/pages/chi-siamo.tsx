import { StaticPage } from '@/components/layout/static-page';
import { useLanguage } from '@/lib/i18n';

export function ChiSiamoPage() {
  const { t } = useLanguage();

  const values = [
    { title: t('chiSiamo.value1Title'), text: t('chiSiamo.value1Text') },
    { title: t('chiSiamo.value2Title'), text: t('chiSiamo.value2Text') },
    { title: t('chiSiamo.value3Title'), text: t('chiSiamo.value3Text') },
  ];

  return (
    <StaticPage
      title={t('chiSiamo.title')}
      intro={t('chiSiamo.intro')}
      aside={
        <ul className="border-t-[3px] border-pine">
          {values.map((value) => (
            <li key={value.title} className="border-b border-line py-5">
              <h3 className="text-[17px] font-extrabold text-pine">{value.title}</h3>
              <p className="mt-1 text-base leading-7 text-ink">{value.text}</p>
            </li>
          ))}
        </ul>
      }
    >
      <section>
        <h2 className="text-[clamp(1.5rem,2.6vw,1.875rem)] font-black leading-[1.05] tracking-[-0.035em] text-pine">
          {t('chiSiamo.missionTitle')}
        </h2>
        <p className="mt-3 text-base leading-7 text-ink">{t('chiSiamo.missionText')}</p>
      </section>

      <section>
        <h2 className="text-[clamp(1.5rem,2.6vw,1.875rem)] font-black leading-[1.05] tracking-[-0.035em] text-pine">
          {t('chiSiamo.teamTitle')}
        </h2>
        <p className="mt-3 text-base leading-7 text-ink">{t('chiSiamo.teamText')}</p>
      </section>
    </StaticPage>
  );
}

export default ChiSiamoPage;
