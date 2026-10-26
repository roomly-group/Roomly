import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'wouter';
import { Cake, CalendarDays, Camera, GraduationCap, Home, Loader2, Megaphone, Pencil, Quote, Settings, SlidersHorizontal, Wallet } from 'lucide-react';
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
import { APP_ROUTES, formatMonthYear, formatPrice } from '@/lib/constants';
import { editStepHref, fetchOnboarding, type OnboardingData } from '@/lib/onboarding';
import { PROFILE_PHOTO_ACCEPT, PhotoReadError, shrinkPhoto, uploadProfilePhoto } from '@/lib/profile-photo';

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
    <div className="min-w-0 rounded-xl bg-mint-mist px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-sage">{label}</p>
      {loading ? (
        <Skeleton className="mt-1.5 h-4 w-20" />
      ) : (
        <p className="mt-1 break-words text-sm font-extrabold text-pine [overflow-wrap:anywhere]">{value}</p>
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
            {loading ? <Skeleton className="mx-auto h-28 w-28 rounded-full" /> : <ProfilePhoto name={displayName} url={profile?.foto_profilo_url ?? null} />}
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
            {owner ? (
              <>
                <div className="my-5 border-t border-[#e1ebe4]" />
                <Link
                  href={APP_ROUTES.OWNER_PROFILE_PREFERENCES}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#0850411a] px-4 py-3 text-sm font-extrabold text-[#085041] transition-colors hover:border-[#08504140] hover:bg-[#E1F5EE]"
                  data-testid="link-profile-preferences"
                >
                  <SlidersHorizontal size={16} />
                  {t('preferences.open')}
                </Link>
              </>
            ) : null}
          </aside>

          <div className="space-y-5">
            <section data-reveal className="surface rounded-2xl p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div>
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
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <InfoRow label={t('auth.firstNameLabel')} value={profile?.nome || '—'} loading={loading} />
                    <InfoRow label={t('auth.lastNameLabel')} value={profile?.cognome || '—'} loading={loading} />
                    <div className="col-span-2">
                      <InfoRow label={t('profile.labelEmail')} value={profile?.email ?? '—'} loading={loading} />
                    </div>
                  </div>
                  {saveMessage && (
                    <p className="mt-4 text-sm font-semibold text-[#0F6E56]" role="status" data-testid={PROFILE_TEST_IDS.STATUS_PROFILE_EDITING}>
                      {saveMessage}
                    </p>
                  )}
                </>
              )}
            </section>

            {!owner ? <SearchDetails /> : null}

            <LanguageSetting />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ===================== PHOTO =====================

/** Big avatar with the profile photo; choosing a file shrinks it, uploads it and updates the header at once. */
function ProfilePhoto({ name, url }: { name: string; url: string | null }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      patchAccount({ foto_profilo_url: await uploadProfilePhoto(await shrinkPhoto(file)) });
    } catch (uploadError) {
      setError(t(uploadError instanceof PhotoReadError ? 'onboarding.photoReadError' : 'onboarding.photoUploadError'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shutter"
        aria-label={url ? t('profile.photoChange') : t('profile.photoAdd')}
        data-testid="button-profile-photo"
      >
        <Avatar name={name} size="xl" src={url} />
        <span className="absolute bottom-0.5 right-0.5 grid h-9 w-9 place-items-center rounded-full border-2 border-paper bg-shutter text-mint-mist shadow-rest" aria-hidden>
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
        </span>
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mt-2 text-sm font-extrabold text-shutter hover:text-pine"
      >
        {url ? t('profile.photoChange') : t('profile.photoAdd')}
      </button>
      {error ? (
        <p className="mt-1 text-xs font-semibold text-terracotta" role="alert">
          {error}
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={PROFILE_PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
        data-testid="input-profile-photo"
      />
    </div>
  );
}

// ===================== SEARCH DETAILS =====================

const SOURCE_LABELS = {
  instagram: 'onboarding.source.instagram',
  tiktok: 'onboarding.source.tiktok',
  linkedin: 'onboarding.source.linkedin',
  amico: 'onboarding.source.amico',
  google: 'onboarding.source.google',
  ai: 'onboarding.source.ai',
  facebook: 'onboarding.source.facebook',
  altro: 'onboarding.source.altro',
} as const;

const DURATION_LABELS = {
  semestre: 'onboarding.duration.semestre',
  un_anno: 'onboarding.duration.un_anno',
  piu_anni: 'onboarding.duration.piu_anni',
  non_so: 'onboarding.duration.non_so',
} as const;

const NOISE_LABELS = {
  silenzioso: 'preferences.noise.silent',
  medio: 'preferences.noise.medium',
  tollerante: 'preferences.noise.tolerant',
} as const;
const CLEANLINESS_LABELS = {
  molto_ordinato: 'preferences.cleanliness.veryTidy',
  abbastanza_ordinato: 'preferences.cleanliness.tidy',
  tollerante: 'preferences.cleanliness.flexible',
} as const;
const SCHEDULE_LABELS = {
  notturno: 'preferences.schedule.night',
  diurno: 'preferences.schedule.day',
  flessibile: 'preferences.schedule.flexible',
} as const;

/** The onboarding answers, each with a link that reopens its question and comes back here. */
function SearchDetails() {
  const { t, language } = useLanguage();
  const [data, setData] = useState<OnboardingData | null>(null);

  useEffect(() => {
    let active = true;
    fetchOnboarding()
      .then((result) => active && setData(result))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!data) return null;

  const birth = data.data_nascita
    ? new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${data.data_nascita}T00:00:00`))
    : null;
  const arrival = [
    data.arrivo_previsto ? formatMonthYear(new Date(`${data.arrivo_previsto}T00:00:00`), language) : null,
    data.durata_permanenza ? t(DURATION_LABELS[data.durata_permanenza]) : null,
  ].filter(Boolean).join(' · ') || null;
  const budget = data.preferenze?.budget_max != null
    ? t('onboarding.budgetUpTo').replace('{price}', formatPrice(Number(data.preferenze.budget_max), language))
    : null;
  const university = [data.universita, data.corso_di_studio].filter(Boolean).join(' · ') || null;
  const prefs = data.preferenze;
  const lifestyle = prefs
    ? [
        prefs.animali === true ? t('profile.lifestylePetsYes') : prefs.animali === false ? t('profile.lifestylePetsNo') : null,
        prefs.fumatori === true ? t('profile.lifestyleSmokingYes') : prefs.fumatori === false ? t('profile.lifestyleSmokingNo') : null,
        t(NOISE_LABELS[prefs.livello_rumore_preferito]),
        t(CLEANLINESS_LABELS[prefs.ordine_pulizia]),
        t(SCHEDULE_LABELS[prefs.orari_sosta]),
      ].filter(Boolean).join(' · ')
    : null;

  const tiles: { step: string; icon: ReactNode; label: string; value: string | null; wide?: boolean }[] = [
    { step: 'university', icon: <GraduationCap size={16} />, label: t('onboarding.universityLabel'), value: university },
    { step: 'arrival', icon: <CalendarDays size={16} />, label: t('waitlistConfirmed.searchArrival'), value: arrival },
    { step: 'budget', icon: <Wallet size={16} />, label: t('waitlistConfirmed.searchBudget'), value: budget },
    { step: 'lifestyle', icon: <Home size={16} />, label: t('profile.lifestyleLabel'), value: lifestyle },
    { step: 'birth', icon: <Cake size={16} />, label: t('auth.dateOfBirthLabel'), value: birth },
    { step: 'source', icon: <Megaphone size={16} />, label: t('profile.sourceLabel'), value: data.fonte_scoperta ? t(SOURCE_LABELS[data.fonte_scoperta]) : null },
    { step: 'about', icon: <Quote size={16} />, label: t('profile.aboutLabel'), value: data.bio, wide: true },
  ];

  return (
    <section className="surface rounded-2xl p-5 sm:p-6" data-testid="panel-profile-search">
      <h2 className="mb-4 text-xl font-black text-pine">{t('profile.searchTitle')}</h2>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {tiles.map((tile) => (
          <li key={tile.step} className={tile.wide ? 'sm:col-span-2' : undefined}>
            <Link
              href={editStepHref(tile.step, 'profile')}
              className="group flex h-full items-start gap-3 rounded-xl border border-line bg-cream px-3.5 py-3 transition-colors hover:border-shutter hover:bg-mint-mist"
              aria-label={`${t('profile.searchEdit')}: ${tile.label}`}
              data-testid={`link-edit-${tile.step}`}
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mint-mist text-shutter group-hover:bg-paper" aria-hidden>
                {tile.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-black uppercase tracking-wider text-sage">{tile.label}</span>
                <span className={`mt-0.5 line-clamp-2 text-sm font-extrabold leading-5 ${tile.value ? 'text-pine' : 'text-sage'}`}>
                  {tile.value ?? t('profile.notSet')}
                </span>
              </span>
              <Pencil size={14} className="mt-1 shrink-0 text-sage transition-colors group-hover:text-shutter" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StudentProfileRoute() {
  return <ProfilePage />;
}

export function OwnerProfileRoute() {
  return <ProfilePage owner />;
}

export default ProfilePage;