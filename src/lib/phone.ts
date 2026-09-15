import type { MomoNetwork } from "@/lib/supabase/types";

/**
 * Ghana phone numbers.
 *
 * Phone is the identity key across ArtisanGH — not email. People type their
 * number every way imaginable (024 123 4567, +233 24 123 4567, 233241234567),
 * so normalise aggressively at every boundary and store only E.164.
 */

const E164 = /^\+233[235]\d{8}$/;

/**
 * Ghanaian mobile prefixes, written in local 0XX form.
 * Telecel was Vodafone until the 2023 rebrand; Paystack's bank list still calls
 * it "VOD", which matters when creating transfer recipients.
 */
const NETWORK_PREFIXES: Record<MomoNetwork, string[]> = {
  mtn: ["024", "025", "053", "054", "055", "059"],
  telecel: ["020", "050"],
  airteltigo: ["026", "027", "056", "057"],
};

/**
 * Convert any plausible user input to E.164, or null if it cannot be one.
 *
 *   "024 123 4567"    → "+233241234567"
 *   "+233 24 123 4567"→ "+233241234567"
 *   "233241234567"    → "+233241234567"
 *   "241234567"       → "+233241234567"
 */
export function normalisePhone(input: string): string | null {
  if (!input) return null;

  let digits = input.replace(/[^\d+]/g, "");

  if (digits.startsWith("+233")) {
    digits = digits.slice(4);
  } else if (digits.startsWith("233")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("+")) {
    return null; // some other country
  }

  if (digits.length !== 9) return null;

  const candidate = `+233${digits}`;
  return E164.test(candidate) ? candidate : null;
}

export function isValidGhanaPhone(input: string): boolean {
  return normalisePhone(input) !== null;
}

/** "+233241234567" → "024 123 4567". Use everywhere a number is shown. */
export function formatPhoneForDisplay(e164: string): string {
  const match = /^\+233(\d{2})(\d{3})(\d{4})$/.exec(e164);
  if (!match) return e164;
  const [, a, b, c] = match;
  return `0${a} ${b} ${c}`;
}

/**
 * Infer the mobile money network from the number. A convenience default only —
 * the user can always override, because ported numbers exist and getting this
 * wrong means a failed payout.
 */
export function detectMomoNetwork(e164: string): MomoNetwork | null {
  const normalised = normalisePhone(e164);
  if (!normalised) return null;

  const localPrefix = `0${normalised.slice(4, 6)}`;

  for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    if (prefixes.includes(localPrefix)) return network as MomoNetwork;
  }

  return null;
}

export const MOMO_NETWORK_LABELS: Record<MomoNetwork, string> = {
  mtn: "MTN MoMo",
  telecel: "Telecel Cash",
  airteltigo: "AirtelTigo Money",
};

/**
 * Paystack needs an email even though our users sign in by phone, and many
 * Ghanaian users have no email at all. Synthesised deterministically so the
 * same person always maps to the same auth identity.
 */
export function syntheticEmailForPhone(e164: string): string {
  return `${e164.replace("+", "")}@phone.artisangh.app`;
}
