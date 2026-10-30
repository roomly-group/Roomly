import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { Camera, Loader2, Settings, SlidersHorizontal } from 'lucide-react';
import { API_BASE_PATH, API_ROUTE_PATHS, PROFILE_BIO_MAX_LENGTH_CHARS, USER_PREFERENCE_OPTIONS, type UserPreferences } from '@workspace/api-zod';
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
import { fetchOnboarding, fromBoolean, isAdult, toBoolean, type OnboardingData, type YesNoAny } from '@/lib/onboarding';
import { ChipGroup, ChoiceChip } from '@/components/onboarding/choice';
import { BirthDatePicker } from '@/components/shared/birth-date-picker';
import { PROFILE_PHOTO_ACCEPT, PhotoReadError, shrinkPhoto, uploadProfilePhoto } from '@/lib/profile-photo';

// ===================== CONFIGURATION =====================

/** Stable test selectors used by profile editing controls. */
const PROFILE_TEST_IDS = {
  STATUS_PROFILE_EDITING: 'status-profile-editing',
  BUTTON_PROFILE_SETTINGS: 'button-profile-settings',
  BUTTON_SAVE_PROFILE: 'button-save-profile',
} as const;

/** Rows of the "About you" textarea in the edit form. */
const BIO_TEXTAREA_ROWS = 4 as const;
/** How the date of birth is written in "Personal information". */
const BIRTH_DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
/** Same text field look as the onboarding "About you" step. */
const TEXTAREA_CLASS =
  'w-full resize-none rounded-xl border border-field bg-paper px-3.5 py-3 text-base leading-7 text-ink transition-[border-color,box-shadow] placeholder:text-sage-placeholder focus-visible:border-shutter focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mint-wash/40';

/** data_nascita is "yyyy-MM-dd" or '' (not set); bio is '' when empty. */
type ProfileDraft = { nome: string; cognome: string; email: string; data_nascita: string; bio: string };

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
        <p className="mt-1 whitespace-pre-line break-words text-sm font-extrabold text-pine [overflow-wrap:anywhere]">{value}</p>
      )}
    </div>
  );
}

export function ProfilePage({ owner = false }: { owner?: boolean }) {
  const { t, language } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>({ nome: '', cognome: '', email: '', data_nascita: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  // Same shared /api/me cache as the header: shown instantly after the first load.
  const { account: profile, loading } = useAccount();
  // Date of birth, bio and the search answers live in GET /api/me/onboarding.
  // Loaded once here and shared with "Your preferences" so the page makes one call.
  const [details, setDetails] = useState<OnboardingData | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchOnboarding()
      .then((result) => active && setDetails(result))
      .catch(() => undefined)
      .finally(() => active && setDetailsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const birthText = details?.data_nascita
    ? new Intl.DateTimeFormat(language, BIRTH_DATE_FORMAT).format(new Date(`${details.data_nascita}T00:00:00`))
    : '—';

  const displayName = profile?.full_name?.trim() || profile?.email || 'Utente';

  function openEditor() {
    setDraft({
      nome: profile?.nome ?? '',
      cognome: profile?.cognome ?? '',
      email: profile?.email ?? '',
      data_nascita: details?.data_nascita ?? '',
      bio: details?.bio ?? '',
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
    if (draft.data_nascita && !isAdult(draft.data_nascita)) {
      setSaveError(t('auth.ageUnder18'));
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

      // Date of birth and bio: only the fields that changed. Skipped when they
      // never loaded, so a failed load can't wipe the saved bio. A date can be
      // changed but not removed (the backend requires a valid one).
      if (details) {
        const bio = draft.bio.trim();
        const changes: { data_nascita?: string; bio?: string | null } = {};
        if (draft.data_nascita && draft.data_nascita !== details.data_nascita) changes.data_nascita = draft.data_nascita;
        if (bio !== (details.bio ?? '')) changes.bio = bio || null;
        if (Object.keys(changes).length > 0) {
          const detailsResponse = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_ONBOARDING}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(changes),
          });
          if (!detailsResponse.ok) throw await profileError(detailsResponse);
          setDetails((await detailsResponse.json()) as OnboardingData);
        }
      }

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
                    <div className="space-y-2">
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
                    {details ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="profile-birth-date">{t('auth.dateOfBirthLabel')}</Label>
                          <BirthDatePicker
                            id="profile-birth-date"
                            value={draft.data_nascita}
                            onChange={(value) => setDraft((current) => ({ ...current, data_nascita: value }))}
                            testId="input-profile-birth-date"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="profile-bio">{t('profile.aboutLabel')}</Label>
                          <textarea
                            id="profile-bio"
                            rows={BIO_TEXTAREA_ROWS}
                            maxLength={PROFILE_BIO_MAX_LENGTH_CHARS}
                            placeholder={t('onboarding.aboutPlaceholder')}
                            value={draft.bio}
                            onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))}
                            className={TEXTAREA_CLASS}
                            aria-describedby="profile-bio-count"
                            data-testid="input-profile-bio"
                          />
                          <p id="profile-bio-count" className="text-right text-xs font-bold tabular-nums text-sage">
                            {draft.bio.length}/{PROFILE_BIO_MAX_LENGTH_CHARS}
                          </p>
                        </div>
                      </>
                    ) : null}
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
                    {/* Phones: first and last name share a row; email, date of birth and bio take the full width. */}
                    <div className="col-span-2 sm:col-span-1">
                      <InfoRow label={t('profile.labelEmail')} value={profile?.email ?? '—'} loading={loading} />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <InfoRow label={t('auth.dateOfBirthLabel')} value={birthText} loading={detailsLoading} />
                    </div>
                    <div className="col-span-2">
                      <InfoRow label={t('profile.aboutLabel')} value={details?.bio || '—'} loading={detailsLoading} />
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

            {!owner && details ? <PreferencesSection data={details} onSaved={setDetails} /> : null}

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

// ===================== PREFERENCES =====================

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
const STUDY_LABELS = {
  silenzioso: 'preferences.study.quiet',
  con_musica: 'preferences.study.music',
  flessibile: 'preferences.study.flexible',
} as const;
const YES_NO_LABELS = {
  yes: 'preferences.yes',
  no: 'preferences.no',
  any: 'preferences.noPreference',
} as const;
const YES_NO_OPTIONS = ['yes', 'no', 'any'] as const;
/** A key of the translations (the type `t` accepts). */
type TextKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

/** The six answers as the chips hold them; null = not answered yet. */
type PreferencesDraft = {
  pets: YesNoAny | null;
  smoking: YesNoAny | null;
  noise: UserPreferences['livello_rumore_preferito'] | null;
  cleanliness: UserPreferences['ordine_pulizia'] | null;
  schedule: UserPreferences['orari_sosta'] | null;
  study: UserPreferences['abitudini_studio'] | null;
};

/**
 * Saved preferences -> chips. Pets and smoking are stored as true/false/null,
 * so once a preference row exists, null is shown as "No preference".
 */
function draftFrom(prefs: UserPreferences | null): PreferencesDraft {
  const yesNo = (value: boolean | null | undefined) => fromBoolean(value) ?? (prefs ? 'any' : null);
  return {
    pets: yesNo(prefs?.animali),
    smoking: yesNo(prefs?.fumatori),
    noise: prefs?.livello_rumore_preferito ?? null,
    cleanliness: prefs?.ordine_pulizia ?? null,
    schedule: prefs?.orari_sosta ?? null,
    study: prefs?.abitudini_studio ?? null,
  };
}

/** One question with its chips; picking a chip only changes the draft until Save. */
function PreferenceGroup<T extends string>({
  legend,
  name,
  options,
  labels,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  labels: Record<T, TextKey>;
  value: T | null;
  onChange: (next: T) => void;
}) {
  const { t } = useLanguage();
  return (
    <ChipGroup legend={legend}>
      {options.map((option) => (
        <ChoiceChip key={option} name={name} value={option} checked={value === option} onSelect={() => onChange(option)}>
          {t(labels[option])}
        </ChoiceChip>
      ))}
    </ChipGroup>
  );
}

/**
 * Students' home habits (same questions as the onboarding lifestyle screen).
 * The six questions sit right inside the card, in two columns from sm up.
 * Picking a chip only changes a draft; "Save changes" sends it to the backend.
 */
function PreferencesSection({ data, onSaved }: { data: OnboardingData; onSaved: (updated: OnboardingData) => void }) {
  const { t } = useLanguage();
  const saved = draftFrom(data.preferenze);
  const [draft, setDraft] = useState<PreferencesDraft>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // After a save the parent passes the new answers: the draft follows them.
  useEffect(() => {
    setDraft(draftFrom(data.preferenze));
  }, [data.preferenze]);

  // Save stays disabled until at least one answer differs from what is saved.
  const changed = (Object.keys(draft) as (keyof PreferencesDraft)[]).some((key) => draft[key] !== saved[key]);

  function set<K extends keyof PreferencesDraft>(key: K, value: PreferencesDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
    setMessage(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed || saving) return;

    // Only answered questions are sent; the backend validates every value.
    const preferenze: Partial<UserPreferences> = {};
    if (draft.pets) preferenze.animali = toBoolean(draft.pets);
    if (draft.smoking) preferenze.fumatori = toBoolean(draft.smoking);
    if (draft.noise) preferenze.livello_rumore_preferito = draft.noise;
    if (draft.cleanliness) preferenze.ordine_pulizia = draft.cleanliness;
    if (draft.schedule) preferenze.orari_sosta = draft.schedule;
    if (draft.study) preferenze.abitudini_studio = draft.study;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_ONBOARDING}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferenze }),
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      onSaved((await response.json()) as OnboardingData);
      setMessage(t('profile.searchSaved'));
    } catch {
      // Friendly text only: the technical reason stays out of the page.
      setError(t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface rounded-2xl p-5 sm:p-6" data-testid="panel-profile-preferences">
      <h2 className="mb-5 text-xl font-black text-pine">{t('profile.searchTitle')}</h2>

      <form onSubmit={save} noValidate>
        {/* Phones: one question per row. From sm: two columns. */}
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <PreferenceGroup legend={t('onboarding.lifestylePets')} name="profile-animali" options={YES_NO_OPTIONS} labels={YES_NO_LABELS} value={draft.pets} onChange={(v) => set('pets', v)} />
          <PreferenceGroup legend={t('onboarding.lifestyleSmoking')} name="profile-fumatori" options={YES_NO_OPTIONS} labels={YES_NO_LABELS} value={draft.smoking} onChange={(v) => set('smoking', v)} />
          <PreferenceGroup legend={t('preferences.noise')} name="profile-rumore" options={USER_PREFERENCE_OPTIONS.noise} labels={NOISE_LABELS} value={draft.noise} onChange={(v) => set('noise', v)} />
          <PreferenceGroup legend={t('preferences.cleanliness')} name="profile-pulizia" options={USER_PREFERENCE_OPTIONS.cleanliness} labels={CLEANLINESS_LABELS} value={draft.cleanliness} onChange={(v) => set('cleanliness', v)} />
          <PreferenceGroup legend={t('preferences.schedule')} name="profile-orari" options={USER_PREFERENCE_OPTIONS.schedule} labels={SCHEDULE_LABELS} value={draft.schedule} onChange={(v) => set('schedule', v)} />
          <PreferenceGroup legend={t('preferences.study')} name="profile-studio" options={USER_PREFERENCE_OPTIONS.studyHabits} labels={STUDY_LABELS} value={draft.study} onChange={(v) => set('study', v)} />
        </div>

        {error ? (
          <p className="mt-5 text-sm font-semibold text-terracotta" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-5 text-sm font-semibold text-shutter" role="status" data-testid="status-preferences-saved">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!changed || saving}
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-shutter px-5 text-[15px] font-extrabold text-mint-mist transition-colors hover:bg-pine disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="button-save-preferences"
        >
          {saving ? <Loader2 size={17} className="animate-spin" aria-hidden /> : null}
          {saving ? t('profile.saving') : t('profile.save')}
        </button>
      </form>
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