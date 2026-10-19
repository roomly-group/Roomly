import { UserPlus, ShieldCheck, Sparkle } from 'lucide-react';
import { StaticPage } from '@/components/layout/static-page';
import { useLanguage } from '@/lib/i18n';

export function ChiSiamoPage() {
  const { t } = useLanguage();

  return (
    <StaticPage
      eyebrow={t('footer.column.empresa')}
      title={t('chiSiamo.title')}
      intro={t('chiSiamo.intro')}
    >
      <div>
        <h2 className="mb-2 text-lg font-black text-ink">{t('chiSiamo.missionTitle')}</h2>
        <p className="text-sm leading-relaxed text-sage">
          {t('chiSiamo.missionText')}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <ValueCard
          icon={<UserPlus size={20} />}
          title={t('chiSiamo.value1Title')}
          text={t('chiSiamo.value1Text')}
        />
        <ValueCard
          icon={<ShieldCheck size={20} />}
          title={t('chiSiamo.value2Title')}
          text={t('chiSiamo.value2Text')}
        />
        <ValueCard
          icon={<Sparkle size={20} />}
          title={t('chiSiamo.value3Title')}
          text={t('chiSiamo.value3Text')}
        />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-black text-ink">{t('chiSiamo.teamTitle')}</h2>
        <p className="text-sm leading-relaxed text-sage">
          {t('chiSiamo.teamText')}
        </p>
      </div>
    </StaticPage>
  );
}

function ValueCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[20px] border border-pine/10 bg-paper p-6 shadow-rest">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-mint-mist text-pine">
        {icon}
      </div>
      <h3 className="mb-1.5 text-base font-black text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-sage">{text}</p>
    </div>
  );
}

export default ChiSiamoPage;
