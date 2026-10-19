import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { SectionHead } from '@/components/shared/section-head';
import { Button } from '@/components/shared/button';
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

  const rows = [
    { label: t('profile.labelEmail'), value: profile?.email ?? '—' },
    { label: t('auth.firstNameLabel'), value: profile?.nome || '—' },
    { label: t('auth.lastNameLabel'), value: profile?.cognome || '—' },
    { label: t('waitlistConfirmed.menuPositionLabel'), value: profile?.posizione != null ? `#${profile.posizione}` : '—' },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
        <PageIntro
          title={owner ? t('profile.ownerEyebrow') : t('profile.studentEyebrow')}
          lede={owner ? t('profile.ownerDescription') : t('profile.studentDescription')}
        />

        <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="min-w-0 space-y-14 lg:col-span-7">
            <div className="flex items-center gap-4 border-y border-line py-5">
              {loading ? <Skeleton className="h-14 w-14 rounded-full" /> : <Avatar name={displayName} size="lg" />}
              <div className="min-w-0">
                {loading ? (
                  <Skeleton className="h-6 w-40" />
                ) : (
                  <h2 className="truncate text-[22px] font-black leading-tight text-pine">{displayName}</h2>
                )}
                {loading ? (
                  <Skeleton className="mt-2 h-4 w-48" />
                ) : (
                  <p className="mt-0.5 truncate text-[15px] text-sage">{profile?.email ?? ''}</p>
                )}
                <p className="mt-1 flex items-center gap-1.5 text-[13px] font-extrabold text-shutter">
                  <CircleCheck size={14} aria-hidden /> {t('profile.identityChecked')}
                </p>
              </div>
            </div>

            <section aria-labelledby="profile-details">
              <SectionHead
                id="profile-details"
                title={t('profile.aboutYou')}
                action={
                  <button
                    type="button"
                    onClick={editing ? () => setEditing(false) : openEditor}
                    disabled={loading || saving}
                    className="inline-flex min-h-11 shrink-0 items-center px-1 text-[15px] font-extrabold text-shutter underline decoration-shutter/40 underline-offset-4 hover:decoration-2 hover:decoration-shutter disabled:opacity-50"
                    data-testid={PROFILE_TEST_IDS.BUTTON_PROFILE_SETTINGS}
                    aria-expanded={editing}
                    aria-controls="profile-details-body"
                  >
                    {editing ? t('profile.cancel') : t('profile.edit')}
                  </button>
                }
              />
              <div id="profile-details-body" className="mt-5">
                {editing ? (
                  <form onSubmit={saveProfile} className="space-y-5" data-testid="form-profile-edit">
                    <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
                      <div className="flex flex-col gap-2">
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
                      <div className="flex flex-col gap-2">
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
                      <div className="flex flex-col gap-2 sm:col-span-2">
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
                    {saveError && (
                      <p className="text-sm font-bold text-terracotta" role="alert">
                        {saveError}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={saving} className="h-12 px-6 text-base" data-testid={PROFILE_TEST_IDS.BUTTON_SAVE_PROFILE}>
                        {saving ? t('profile.saving') : t('profile.save')}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={saving} className="h-12 px-5 text-base">
                        {t('profile.cancel')}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <dl className="grid border-t border-line sm:grid-cols-2 sm:gap-x-10">
                      {rows.map((row) => (
                        <div key={row.label} className="border-b border-line py-3.5">
                          <dt className="text-[13px] font-extrabold text-sage">{row.label}</dt>
                          <dd className="mt-0.5 truncate text-base tabular-nums text-ink">
                            {loading ? <Skeleton className="mt-1 h-4 w-24" /> : row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {saveMessage && (
                      <p className="mt-4 text-sm font-bold text-shutter" role="status" data-testid={PROFILE_TEST_IDS.STATUS_PROFILE_EDITING}>
                        {saveMessage}
                      </p>
                    )}
                  </>
                )}
              </div>
            </section>

            <LanguageSetting />
          </div>

          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="border-t-[3px] border-pine pt-4">
              <Link
                href={owner ? APP_ROUTES.OWNER_PROFILE_PREFERENCES : APP_ROUTES.PROFILE_PREFERENCES}
                className="group flex min-h-11 items-center justify-between gap-3 text-[17px] font-extrabold text-pine"
                data-testid="link-profile-preferences"
              >
                <span className="underline decoration-pine/25 underline-offset-4 group-hover:decoration-2 group-hover:decoration-shutter">
                  {t('preferences.open')}
                </span>
                <ArrowRight size={18} className="shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <p className="mt-1 text-[15px] leading-6 text-sage">{t('preferences.title')}</p>
            </div>
          </aside>
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