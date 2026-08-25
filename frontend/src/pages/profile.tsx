import { useState } from 'react';
import { PenLine, Settings, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { Button } from '@/components/shared/button';
import { PageIntro } from '@/components/shared/page-intro';
import { LanguageSetting } from '@/components/language-selector';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#E1F5EE] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-[#527067]">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-[#085041]">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d6e7de] p-4">
      <p className="text-2xl font-black text-[#0F6E56]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#527067]">{label}</p>
    </div>
  );
}

export function ProfilePage({ owner = false }: { owner?: boolean }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);

  return (
    <AppShell owner={owner}>
      <div className="mx-auto max-w-[920px] px-5 py-8 lg:px-8 lg:py-12">
        <PageIntro
          eyebrow={owner ? t('profile.ownerEyebrow') : t('profile.studentEyebrow')}
          title={owner ? t('profile.ownerTitle') : t('profile.studentTitle')}
          description={owner ? t('profile.ownerDescription') : t('profile.studentDescription')}
        />

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="surface h-fit rounded-2xl p-5 text-center">
            <Avatar name={owner ? 'Maya Patel' : 'Sam Taylor'} size="lg" />
            <h2 className="mt-3 text-lg font-black text-[#085041]">
              {owner ? 'Maya Patel' : 'Sam Taylor'}
            </h2>
            <p className="mt-1 text-sm text-[#527067]">
              {owner ? t('profile.ownerSubtitle') : t('profile.studentSubtitle')}
            </p>
            <div className="my-5 border-t border-[#e1ebe4]" />
            <div className="flex items-center justify-center gap-1 text-xs font-extrabold text-[#0F6E56]">
              <ShieldCheck size={14} /> {t('profile.identityChecked')}
            </div>
            
            {editing && (
              <p className="mt-3 text-left text-xs font-bold leading-5 text-[#527067]" data-testid="status-profile-editing">
                {t('profile.editingStatus')}
              </p>
            )}
          </aside>

          <div className="space-y-5">
            <section className="surface rounded-2xl p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="eyebrow">{t('profile.aboutYou')}</p>
                  <h2 className="mt-1 text-xl font-black text-[#085041]">{t('profile.usefulBits')}</h2>
                </div>
                <button
                  onClick={() => setEditing(!editing)}
                  className="rounded-lg p-2 text-[#0F6E56] hover:bg-[#E1F5EE]"
                  data-testid="button-profile-settings"
                  aria-label={t('profile.profileSettings')}
                >
                  <Settings size={18} />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoRow
                  label={t('profile.labelEmail')}
                  value={owner ? 'maya.patel@example.com' : 'sam.taylor@example.com'}
                />
                <InfoRow label={t('profile.labelBasedAround')} value={t('zones.northCampus')} />
                <InfoRow
                  label={t('profile.labelLookingFor')}
                  value={owner ? t('profile.ownerLookingFor') : t('profile.studentLookingFor')}
                />
                <InfoRow label={t('profile.labelPreferredContact')} value={t('profile.preferredContactValue')} />
              </div>
            </section>

            <LanguageSetting />

            <section className="surface rounded-2xl p-5 sm:p-7">
              <p className="eyebrow">{t('profile.yourHabits')}</p>
              <h2 className="mt-1 text-xl font-black text-[#085041]">
                {owner ? t('profile.ownerHabits') : t('profile.studentHabits')}
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat
                  label={owner ? t('profile.statOwnerActive') : t('profile.statStudentSaved')}
                  value={owner ? '2' : '6'}
                />
                <Stat label={t('profile.statConversations')} value="4" />
                <Stat label={t('profile.statJoined')} value={owner ? '2022' : '2024'} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export function StudentProfileRoute() {
  return <ProfilePage />;
}

export function OwnerProfileRoute() {
  return <ProfilePage owner />;
}
