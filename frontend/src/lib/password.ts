// Client-side password strength policy.
//
// NOTE: this is a UX layer only — it improves the signals shown to the user
// before they submit, it is not the security boundary. The real enforcement
// has to live server-side, since any client-side check can be bypassed by
// calling the API directly. For this app that means the Supabase Auth
// project settings (Authentication -> Policies / Password requirements),
// which should be configured with at least the same minimum length (8) and,
// where available on the plan, the "Minimum password strength" / breached
// password checks. Keep this file's MIN_LENGTH and REQUIREMENTS in sync with
// whatever is configured in the Supabase dashboard.

export const PASSWORD_MIN_LENGTH = 8;

// Same symbol set Supabase Auth accepts for its "Password Requirements"
// option, so a password that passes here also passes there:
// !@#$%^&*()_+-=[]{};'\:"|<>?,./`~
const SYMBOL_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/;

export interface PasswordCheck {
  minLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

export function checkPassword(password: string): PasswordCheck {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: SYMBOL_REGEX.test(password),
  };
}

export function isPasswordStrongEnough(password: string): boolean {
  const check = checkPassword(password);
  return check.minLength && check.hasUpperCase && check.hasLowerCase && check.hasNumber && check.hasSymbol;
}
