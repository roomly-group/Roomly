import { API_BASE_PATH, API_ROUTE_PATHS, INVITE_QUERY_PARAM, MINIMUM_SIGNUP_AGE_YEARS, ONBOARDING_OPTIONS, type UserPreferences } from '@workspace/api-zod';

// Shared by the onboarding page and the waitlist page (which links back to
// the optional questions while some are unanswered). Backend: routes/onboarding.ts.

/** `/onboarding?completa` opens the optional questions instead of forwarding to the waitlist page. */
export const ONBOARDING_EXTRAS_QUERY = 'completa' as const;
/** `&torna=profilo`: after editing one question, go back to the profile instead of the waitlist page. */
export const ONBOARDING_RETURN_QUERY = 'torna' as const;
export const ONBOARDING_RETURN_PROFILE = 'profilo' as const;

/** Link that reopens one onboarding question for editing. */
export function editStepHref(step: string, from: 'profile' | 'waitlist') {
  const back = from === 'profile' ? `&${ONBOARDING_RETURN_QUERY}=${ONBOARDING_RETURN_PROFILE}` : '';
  return `/onboarding?${ONBOARDING_EXTRAS_QUERY}=${step}${back}`;
}

export const ONBOARDING_EXTRA_STEPS = ['lifestyle', 'about'] as const;
export type OnboardingExtraStep = (typeof ONBOARDING_EXTRA_STEPS)[number];

export type OnboardingSource = (typeof ONBOARDING_OPTIONS.sources)[number];
export type OnboardingStayDuration = (typeof ONBOARDING_OPTIONS.stayDurations)[number];

/** GET /api/me/onboarding. */
export type OnboardingData = {
  posizione: number | null;
  nome: string;
  cognome: string;
  /** From the Google profile, used to prefill the name step when nome/cognome are empty. */
  nome_suggerito: string;
  cognome_suggerito: string;
  data_nascita: string | null;
  /** First answer to "Come ci hai scoperto?" (null until answered). */
  fonte_scoperta: OnboardingSource | null;
  /** Every answer to "Come ci hai scoperto?", in the order of ONBOARDING_OPTIONS.sources. */
  fonti_scoperta: OnboardingSource[];
  fonte_scoperta_altro: string | null;
  foto_profilo_url: string | null;
  universita: string | null;
  corso_di_studio: string | null;
  arrivo_previsto: string | null;
  durata_permanenza: OnboardingStayDuration | null;
  bio: string | null;
  preferenze: UserPreferences | null;
  onboarding_completato_at: string | null;
};

/** True when a "yyyy-MM-dd" birth date is at least MINIMUM_SIGNUP_AGE_YEARS ago (the backend checks it again). */
export function isAdult(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age >= MINIMUM_SIGNUP_AGE_YEARS;
}

/** A yes/no preference as the chips show it: 'any' = "No preference" (saved as null). */
export type YesNoAny = 'yes' | 'no' | 'any';
export const fromBoolean = (value: boolean | null | undefined): YesNoAny | null =>
  value === true ? 'yes' : value === false ? 'no' : null;
export const toBoolean = (value: YesNoAny): boolean | null => (value === 'yes' ? true : value === 'no' ? false : null);

export async function fetchOnboarding(): Promise<OnboardingData> {
  const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_ONBOARDING}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return (await response.json()) as OnboardingData;
}

// ===================== INVITES =====================

/** Where the invite code from a link waits until the new account exists (per-browser). */
const INVITE_STORAGE_KEY = 'roomly.invite' as const;

/** Called on every page load: keeps `?invito=CODE` from the link until signup is done. */
export function rememberInviteFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get(INVITE_QUERY_PARAM);
    if (code && /^[a-z0-9]{4,12}$/i.test(code)) window.localStorage.setItem(INVITE_STORAGE_KEY, code);
  } catch {
    // Storage unavailable: the invite is simply not counted.
  }
}

/** Sends a remembered invite code to the backend once, right after signup. Never fails the caller. */
export async function claimStoredInvite(): Promise<void> {
  let code: string | null = null;
  try {
    code = window.localStorage.getItem(INVITE_STORAGE_KEY);
  } catch {
    return;
  }
  if (!code) return;
  try {
    const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_INVITE_CLAIM}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codice: code }),
    });
    if (response.ok) window.localStorage.removeItem(INVITE_STORAGE_KEY);
  } catch {
    // Network error: try again on the next visit.
  }
}

/** GET /api/me/invito. */
export type InviteData = { codice: string; invitati: number; bonus: number; posizione: number | null };

export async function fetchInvite(): Promise<InviteData> {
  const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.ME_INVITE}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return (await response.json()) as InviteData;
}

/** The personal link a user shares. */
export function inviteLink(code: string) {
  return `${window.location.origin}/register?${INVITE_QUERY_PARAM}=${encodeURIComponent(code)}`;
}

/** Optional questions still unanswered, in the order the onboarding asks them. */
export function missingExtraSteps(data: OnboardingData): OnboardingExtraStep[] {
  const answered: Record<OnboardingExtraStep, boolean> = {
    // A preference row can exist with default habits only, so
    // only the two yes/no answers tell whether this screen was answered.
    lifestyle: data.preferenze !== null && (data.preferenze.animali !== null || data.preferenze.fumatori !== null),
    about: data.bio !== null && data.bio !== '',
  };
  return ONBOARDING_EXTRA_STEPS.filter((step) => !answered[step]);
}
