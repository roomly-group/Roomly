// In-chat scam warning (audit finding RMY-12). A message from the other person
// that contains payment or off-platform contact details gets a warning under
// it (pages/messages.tsx). Rental scams almost always try to move the student
// to a bank transfer, a phone call, WhatsApp/Telegram or an outside link
// before any visit. This only shows a warning: nothing is blocked or sent
// anywhere, and the check runs in the browser on text the user already sees.

// ===================== CONFIGURATION =====================

/**
 * Patterns that trigger the warning. Kept loose on purpose: a warning on a
 * harmless message costs little, a missed IBAN can cost a deposit.
 */
const SCAM_PATTERNS: readonly RegExp[] = [
  // IBAN: 2 letters, 2 check digits, then 11-30 letters/digits, spaces or dashes allowed (IT60 X054 2811 1010 0000 0123 456).
  /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){11,30}\b/i,
  // Phone number: 9 or more digits, optionally with +/00 and spaces, dots, dashes or slashes between them.
  /(?:\+|\b00)?\d(?:[\s./-]?\d){8,}/,
  // Moving the chat to another app.
  /\b(?:whats\s?app|telegram|signal|viber|wa\.me|t\.me)\b/i,
  // Links: a scheme, "www.", or a bare domain with a common ending.
  /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|it|net|org|eu|io|me|ly|co|info|xyz|link|app|page|site|online)\b/i,
];

/** Storage key: chats where the person hid the safety tip (per browser). */
const SAFETY_TIP_STORAGE_KEY = 'roomly.safetyTipHidden' as const;
/** Most chat ids remembered for the hidden tip, so the stored list stays small. */
const SAFETY_TIP_MAX_REMEMBERED = 200 as const;

// ===================== DETECTION =====================

/** True when the text contains an IBAN, a phone number, a messaging app or a link. */
export function looksLikeScamRisk(text: string): boolean {
  return SCAM_PATTERNS.some((pattern) => pattern.test(text));
}

// ===================== SAFETY TIP =====================

function readHiddenTips(): number[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SAFETY_TIP_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === 'number') : [];
  } catch {
    // Storage blocked (private mode) or a broken value: show the tip.
    return [];
  }
}

/** True when the person hid the safety tip in this chat. */
export function isSafetyTipHidden(conversationId: number): boolean {
  return readHiddenTips().includes(conversationId);
}

/** Remembers that the person hid the safety tip in this chat. */
export function hideSafetyTip(conversationId: number): void {
  try {
    const next = [...readHiddenTips().filter((id) => id !== conversationId), conversationId].slice(-SAFETY_TIP_MAX_REMEMBERED);
    window.localStorage.setItem(SAFETY_TIP_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the tip stays hidden for this page view only.
  }
}
