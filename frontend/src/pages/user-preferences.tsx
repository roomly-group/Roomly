import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { Link } from 'wouter';
import {
  API_BASE_PATH,
  API_ROUTE_PATHS,
  USER_PREFERENCE_OPTIONS,
  type UserPreferences,
} from '@workspace/api-zod';
import { AppShell } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';
import { APP_ROUTES } from '@/lib/constants';

type PreferencesForm = Omit<UserPreferences, 'budget_max'> & { budget_max: string };

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

const DEFAULT_FORM: PreferencesForm = {
  budget_max: '',
  animali: null,
  fumatori: null,
  livello_rumore_preferito: 'medio',
  ordine_pulizia: 'abbastanza_ordinato',
  orari_sosta: 'flessibile',
  abitudini_studio: 'flessibile',
};

function isOneOf<T extends readonly string[]>(options: T, value: string): value is T[number] {
  return options.some((option) => option === value);
}

async function apiError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') return new Error(body.error);
  } catch {
    // Fall back to the HTTP status when the server did not return JSON.
  }

  return new Error(`Request failed (${response.status})`);
}

function PreferenceField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-bold text-[#085041]">{label}</Label>
      {children}
    </div>
  );
}

export function UserPreferencesPage({ owner = false }: { owner?: boolean }) {
  const { t } = useLanguage();
  const [form, setForm] = useState<PreferencesForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPreferences() {
      try {
        const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_PREFERENCES}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) throw await apiError(response);

        const preferences = (await response.json()) as UserPreferences;
        setForm({
          ...preferences,
          budget_max: preferences.budget_max === null ? '' : String(preferences.budget_max),
        });
        setLoadFailed(false);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setLoadFailed(true);
          setError(loadError instanceof Error ? loadError.message : t('preferences.loadError'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPreferences();
    return () => controller.abort();
  }, [loadAttempt, t]);

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const budgetText = form.budget_max.trim();
    const budget = budgetText === '' ? null : Number(budgetText);
    if (
      budget !== null &&
      (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(budgetText) ||
        !Number.isFinite(budget) ||
        budget < 0 ||
        budget > 99_999_999.99)
    ) {
      setError(t('preferences.invalidBudget'));
      return;
    }

    const preferences: UserPreferences = { ...form, budget_max: budget };
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_PREFERENCES}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      if (!response.ok) throw await apiError(response);

      const savedPreferences = (await response.json()) as UserPreferences;
      setForm({
        ...savedPreferences,
        budget_max: savedPreferences.budget_max === null ? '' : String(savedPreferences.budget_max),
      });
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('preferences.saveError'));
    } finally {
      setSaving(false);
    }
  }

  const backHref = owner ? APP_ROUTES.OWNER_PROFILE : APP_ROUTES.PROFILE;

  return (
    <AppShell>
      <div className="mx-auto max-w-[920px] px-5 py-8 lg:px-8 lg:py-12">
        <PageIntro
          eyebrow={t('preferences.eyebrow')}
          title={t('preferences.title')}
          description={t('preferences.description')}
          action={
            <Link
              href={backHref}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#0850411a] px-4 py-2.5 text-sm font-bold text-[#085041] transition-colors hover:bg-[#E1F5EE]"
            >
              <ArrowLeft size={16} />
              {t('preferences.back')}
            </Link>
          }
        />

        <section className="surface rounded-2xl p-5 sm:p-7" data-testid="section-user-preferences">
          <div className="mb-6 flex items-center gap-3">
            <span className="rounded-xl bg-[#E1F5EE] p-2.5 text-[#0F6E56]">
              <SlidersHorizontal size={18} />
            </span>
            <div>
              <h2 className="mt-1 text-xl font-black text-[#085041]">{t('preferences.sectionTitle')}</h2>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-[#527067]" role="status">{t('loading')}</p>
          ) : loadFailed ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  setLoadAttempt((attempt) => attempt + 1);
                }}
                className="rounded-xl border border-[#0850411a] px-4 py-2.5 text-sm font-bold text-[#085041] transition-colors hover:bg-[#E1F5EE]"
              >
                {t('common.tryAgain')}
              </button>
            </div>
          ) : (
            <form onSubmit={savePreferences} className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <PreferenceField id="budget-max" label={t('preferences.budget')}>
                  <Input
                    id="budget-max"
                    type="number"
                    min="0"
                    max="99999999.99"
                    step="0.01"
                    value={form.budget_max}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, budget_max: event.target.value }));
                      setError(null);
                      setSaved(false);
                    }}
                    placeholder={t('preferences.budgetPlaceholder')}
                    data-testid="input-preferences-budget"
                  />
                </PreferenceField>

                {(['animali', 'fumatori'] as const).map((field) => {
                  const isPets = field === 'animali';
                  const value = form[field] === null ? 'unspecified' : form[field] ? 'yes' : 'no';
                  return (
                    <PreferenceField
                      key={field}
                      id={`preference-${field}`}
                      label={isPets ? t('preferences.pets') : t('preferences.smoking')}
                    >
                      <Select
                        value={value}
                        onValueChange={(nextValue) => {
                          const nextPreference = nextValue === 'unspecified' ? null : nextValue === 'yes';
                          setForm((current) => ({ ...current, [field]: nextPreference }));
                          setError(null);
                          setSaved(false);
                        }}
                      >
                        <SelectTrigger id={`preference-${field}`} data-testid={`select-preferences-${field}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unspecified">{t('preferences.noPreference')}</SelectItem>
                          <SelectItem value="yes">{t('preferences.yes')}</SelectItem>
                          <SelectItem value="no">{t('preferences.no')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </PreferenceField>
                  );
                })}

                <PreferenceField id="noise-level" label={t('preferences.noise')}>
                  <Select
                    value={form.livello_rumore_preferito}
                    onValueChange={(value) => {
                      if (isOneOf(USER_PREFERENCE_OPTIONS.noise, value)) {
                        setForm((current) => ({
                          ...current,
                          livello_rumore_preferito: value,
                        }));
                        setError(null);
                        setSaved(false);
                      }
                    }}
                  >
                    <SelectTrigger id="noise-level" data-testid="select-preferences-noise">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_PREFERENCE_OPTIONS.noise.map((value) => (
                        <SelectItem key={value} value={value}>{t(NOISE_LABELS[value])}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PreferenceField>

                <PreferenceField id="cleanliness" label={t('preferences.cleanliness')}>
                  <Select
                    value={form.ordine_pulizia}
                    onValueChange={(value) => {
                      if (isOneOf(USER_PREFERENCE_OPTIONS.cleanliness, value)) {
                        setForm((current) => ({
                          ...current,
                          ordine_pulizia: value,
                        }));
                        setError(null);
                        setSaved(false);
                      }
                    }}
                  >
                    <SelectTrigger id="cleanliness" data-testid="select-preferences-cleanliness">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_PREFERENCE_OPTIONS.cleanliness.map((value) => (
                        <SelectItem key={value} value={value}>{t(CLEANLINESS_LABELS[value])}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PreferenceField>

                <PreferenceField id="schedule" label={t('preferences.schedule')}>
                  <Select
                    value={form.orari_sosta}
                    onValueChange={(value) => {
                      if (isOneOf(USER_PREFERENCE_OPTIONS.schedule, value)) {
                        setForm((current) => ({
                          ...current,
                          orari_sosta: value,
                        }));
                        setError(null);
                        setSaved(false);
                      }
                    }}
                  >
                    <SelectTrigger id="schedule" data-testid="select-preferences-schedule">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_PREFERENCE_OPTIONS.schedule.map((value) => (
                        <SelectItem key={value} value={value}>{t(SCHEDULE_LABELS[value])}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PreferenceField>

                <PreferenceField id="study-habits" label={t('preferences.study')}>
                  <Select
                    value={form.abitudini_studio}
                    onValueChange={(value) => {
                      if (isOneOf(USER_PREFERENCE_OPTIONS.studyHabits, value)) {
                        setForm((current) => ({
                          ...current,
                          abitudini_studio: value,
                        }));
                        setError(null);
                        setSaved(false);
                      }
                    }}
                  >
                    <SelectTrigger id="study-habits" data-testid="select-preferences-study">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_PREFERENCE_OPTIONS.studyHabits.map((value) => (
                        <SelectItem key={value} value={value}>{t(STUDY_LABELS[value])}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PreferenceField>
              </div>

              {error && <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>}
              {saved && <p className="text-sm font-semibold text-[#0F6E56]" role="status">{t('preferences.saved')}</p>}

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#085041] px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#0F6E56] disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="button-save-preferences"
              >
                {saving ? t('preferences.saving') : t('preferences.save')}
              </button>
            </form>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default UserPreferencesPage;
