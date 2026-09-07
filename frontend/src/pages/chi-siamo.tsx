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
        <h2 className="mb-2 text-lg font-black text-[#2C2C2A]">{t('chiSiamo.missionTitle')}</h2>
        <p className="text-sm leading-relaxed text-[#527067]">
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
        <h2 className="mb-2 text-lg font-black text-[#2C2C2A]">{t('chiSiamo.teamTitle')}</h2>
        <p className="text-sm leading-relaxed text-[#527067]">
          {t('chiSiamo.teamText')}
        </p>
      </div>
    </StaticPage>
  );
}

function ValueCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[20px] border border-[#0850411a] bg-[#F1EFE8]/60 p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E1F5EE] text-[#085041]">
        {icon}
      </div>
      <h3 className="mb-1.5 text-base font-black text-[#2C2C2A]">{title}</h3>
      <p className="text-sm leading-relaxed text-[#527067]">{text}</p>
    </div>
  );
}

export default ChiSiamoPage;
