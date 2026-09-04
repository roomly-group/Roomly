import { useEffect, useState } from 'react';
import { Settings, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { LanguageSetting } from '@/components/language-selector';
import { supabase } from '@/lib/supabase';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#E1F5EE] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-[#527067]">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-[#085041]">{value}</p>
    </div>
  );
}

type RealProfile = {
  nome: string;
  cognome: string;
  full_name: string;
  email: string;
  posizione: number;
};

export function ProfilePage({ owner = false }: { owner?: boolean }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<RealProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data?.session?.access_token;

        const response = await fetch('/api/me', {
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
          },
          credentials: 'include',
        });

        if (response.ok) {
          const json = await response.json();
          setProfile(json);
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const displayName = profile?.full_name?.trim() || profile?.email || 'Utente';

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
            <Avatar name={loading ? '—' : displayName} size="lg" />
            <h2 className="mt-3 text-lg font-black text-[#085041]">
              {loading ? 'Caricamento...' : displayName}
            </h2>
            <p className="mt-1 text-sm text-[#527067]">{profile?.email ?? ''}</p>
            <div className="my-5 border-t border-[#e1ebe4]" />
            <div className="flex items-center justify-center gap-1 text-xs font-extrabold text-[#0F6E56]">
              <ShieldCheck size={14} /> {t('profile.identityChecked')}
            </div>

            {editing && (
              <p
                className="mt-3 text-left text-xs font-bold leading-5 text-[#527067]"
                data-testid="status-profile-editing"
              >
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
                <InfoRow label={t('profile.labelEmail')} value={profile?.email ?? '—'} />
                <InfoRow label="Nome" value={profile?.nome || '—'} />
                <InfoRow label="Cognome" value={profile?.cognome || '—'} />
                <InfoRow
                  label="Posizione in waitlist"
                  value={profile ? `#${profile.posizione}` : '—'}
                />
              </div>
            </section>

            <LanguageSetting />
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

export default ProfilePage;