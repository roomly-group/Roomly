import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { Settings, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { LanguageSetting } from '@/components/language-selector';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { patchAccount, useAccount } from '@/lib/account-cache';
import { APP_ROUTES } from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Stable test selectors used by profile editing controls. */
const PROFILE_TEST_IDS = {
  STATUS_PROFILE_EDITING: 'status-profile-editing',
  BUTTON_PROFILE_SETTINGS: 'button-profile-settings',
  BUTTON_SAVE_PROFILE: 'button-save-profile',
} as const;

type ProfileDraft = { nome: string; cognome: string; email: string };

async function profileError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') return new Error(body.error);
  } catch {
    // Fall back to the HTTP status when the server did not return JSON.
  }
  return new Error(`Request failed (${response.status})`);
}

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
  const [draft, setDraft] = useState<ProfileDraft>({ nome: '', cognome: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  // Same shared /api/me cache as the header: shown instantly after the first load.
  const { account: profile, loading } = useAccount();

  const displayName = profile?.full_name?.trim() || profile?.email || 'Utente';

  function openEditor() {
    setDraft({
      nome: profile?.nome ?? '',
      cognome: profile?.cognome ?? '',
      email: profile?.email ?? '',
    });
    setSaveError(null);
    setSaveMessage(null);
    setEditing(true);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaveMessage(null);

    const nome = draft.nome.trim();
    const cognome = draft.cognome.trim();
    const email = draft.email.trim().toLowerCase();
    if (!nome || !cognome) {
      setSaveError(t('profile.nameRequired'));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_PROFILE}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cognome }),
      });
      if (!response.ok) throw await profileError(response);

      const updatedProfile = (await response.json()) as {
        nome: string;
        cognome: string;
        email: string;
        full_name: string;
        posizione?: number | null;
        lingua?: string | null;
      };
      patchAccount(updatedProfile);

      const currentEmail = profile?.email?.trim().toLowerCase() ?? '';
      if (email !== currentEmail) {
        const { data, error } = await supabase.auth.updateUser({ email });
        if (error) {
          setSaveError(`${t('profile.nameSavedEmailFailed')} ${error.message}`);
          return;
        }

        if (data.user.email?.toLowerCase() === email) {
          patchAccount({ email });
          setSaveMessage(t('profile.saved'));
        } else {
          setSaveMessage(t('profile.emailConfirmationSent'));
        }
      } else {
        setSaveMessage(t('profile.saved'));
      }
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  }

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
          </aside>

          <div className="space-y-5">
            <section className="surface rounded-2xl p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="eyebrow">{t('profile.aboutYou')}</p>
                  <h2 className="mt-1 text-xl font-black text-[#085041]">{t('profile.usefulBits')}</h2>
                </div>
                <button
                  type="button"
                  onClick={editing ? () => setEditing(false) : openEditor}
                  disabled={loading || saving}
                  className="rounded-lg p-2 text-[#0F6E56] hover:bg-[#E1F5EE]"
                  data-testid={PROFILE_TEST_IDS.BUTTON_PROFILE_SETTINGS}
                  aria-label={editing ? t('profile.closeEditor') : t('profile.profileSettings')}
                  aria-expanded={editing}
                >
                  <Settings size={18} />
                </button>
              </div>
              {editing ? (
                <form onSubmit={saveProfile} className="space-y-5" data-testid="form-profile-edit">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="profile-first-name">{t('auth.firstNameLabel')}</Label>
                      <Input
                        id="profile-first-name"
                        value={draft.nome}
                        maxLength={50}
                        onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))}
                        autoComplete="given-name"
                        required
                        data-testid="input-profile-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-last-name">{t('auth.lastNameLabel')}</Label>
                      <Input
                        id="profile-last-name"
                        value={draft.cognome}
                        maxLength={50}
                        onChange={(event) => setDraft((current) => ({ ...current, cognome: event.target.value }))}
                        autoComplete="family-name"
                        required
                        data-testid="input-profile-last-name"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="profile-email">{t('profile.labelEmail')}</Label>
                      <Input
                        id="profile-email"
                        type="email"
                        value={draft.email}
                        onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                        autoComplete="email"
                        required
                        data-testid="input-profile-email"
                      />
                    </div>
                  </div>
                  {saveError && <p className="text-sm font-semibold text-red-700" role="alert">{saveError}</p>}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-[#085041] px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#0F6E56] disabled:cursor-not-allowed disabled:opacity-60"
                      data-testid={PROFILE_TEST_IDS.BUTTON_SAVE_PROFILE}
                    >
                      {saving ? t('profile.saving') : t('profile.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      disabled={saving}
                      className="rounded-xl border border-[#0850411a] px-5 py-3 text-sm font-bold text-[#527067] transition-colors hover:bg-[#E1F5EE]"
                    >
                      {t('profile.cancel')}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoRow label={t('profile.labelEmail')} value={profile?.email ?? '—'} loading={loading} />
                    <InfoRow label={t('auth.firstNameLabel')} value={profile?.nome || '—'} loading={loading} />
                    <InfoRow label={t('auth.lastNameLabel')} value={profile?.cognome || '—'} loading={loading} />
                    <InfoRow
                      label="Posizione in waitlist"
                      value={profile?.posizione != null ? `#${profile.posizione}` : '—'}
                      loading={loading}
                    />
                  </div>
                  {saveMessage && (
                    <p className="mt-4 text-sm font-semibold text-[#0F6E56]" role="status" data-testid={PROFILE_TEST_IDS.STATUS_PROFILE_EDITING}>
                      {saveMessage}
                    </p>
                  )}
                </>
              )}
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