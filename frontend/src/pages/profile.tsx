import { useState } from 'react';
import { Link } from 'wouter';
import { Settings, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { LanguageSetting } from '@/components/language-selector';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccount } from '@/lib/account-cache';
import { APP_ROUTES } from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Stable test selectors used by profile editing controls. */
const PROFILE_TEST_IDS = {
  STATUS_PROFILE_EDITING: 'status-profile-editing',
  BUTTON_PROFILE_SETTINGS: 'button-profile-settings',
} as const;

function InfoRow({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="rounded-xl bg-[#E1F5EE] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-[#527067]">{label}</p>
      {loading ? (
        <Skeleton className="mt-1.5 h-4 w-20" />
      ) : (
        <p className="mt-1 text-sm font-extrabold text-[#085041]">{value}</p>
      )}
    </div>
  );
}

export function ProfilePage({ owner = false }: { owner?: boolean }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  // Same shared /api/me cache as the header: shown instantly after the first load.
  const { account: profile, loading } = useAccount();

  const displayName = profile?.full_name?.trim() || profile?.email || 'Utente';

  return (
    <AppShell>
      <div className="mx-auto max-w-[920px] px-5 py-8 lg:px-8 lg:py-12">
        <PageIntro
          eyebrow={owner ? t('profile.ownerEyebrow') : t('profile.studentEyebrow')}
          title={owner ? t('profile.ownerTitle') : t('profile.studentTitle')}
          description={owner ? t('profile.ownerDescription') : t('profile.studentDescription')}
        />

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="surface h-fit rounded-2xl p-5 text-center">
            {loading ? (
              <Skeleton className="mx-auto h-14 w-14 rounded-full" />
            ) : (
              <Avatar name={displayName} size="lg" />
            )}
            {loading ? (
              <Skeleton className="mx-auto mt-3 h-5 w-32" />
            ) : (
              <h2 className="mt-3 text-lg font-black text-[#085041]">{displayName}</h2>
            )}
            {loading ? (
              <Skeleton className="mx-auto mt-1.5 h-4 w-40" />
            ) : (
              <p className="mt-1 text-sm text-[#527067]">{profile?.email ?? ''}</p>
            )}
            <div className="my-5 border-t border-[#e1ebe4]" />
            <div className="flex items-center justify-center gap-1 text-xs font-extrabold text-[#0F6E56]">
              <ShieldCheck size={14} /> {t('profile.identityChecked')}
            </div>
            <Link
              href={owner ? APP_ROUTES.OWNER_PROFILE_PREFERENCES : APP_ROUTES.PROFILE_PREFERENCES}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#0850411a] px-4 py-3 text-sm font-extrabold text-[#085041] transition-colors hover:border-[#08504140] hover:bg-[#E1F5EE]"
              data-testid="link-profile-preferences"
            >
              <SlidersHorizontal size={16} />
              {t('preferences.open')}
            </Link>

            {editing && (
              <p
                className="mt-3 text-left text-xs font-bold leading-5 text-[#527067]"
                data-testid={PROFILE_TEST_IDS.STATUS_PROFILE_EDITING}
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
                  data-testid={PROFILE_TEST_IDS.BUTTON_PROFILE_SETTINGS}
                  aria-label={t('profile.profileSettings')}
                >
                  <Settings size={18} />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoRow label={t('profile.labelEmail')} value={profile?.email ?? '—'} loading={loading} />
                <InfoRow label="Nome" value={profile?.nome || '—'} loading={loading} />
                <InfoRow label="Cognome" value={profile?.cognome || '—'} loading={loading} />
                <InfoRow
                  label="Posizione in waitlist"
                  value={profile?.posizione != null ? `#${profile.posizione}` : '—'}
                  loading={loading}
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