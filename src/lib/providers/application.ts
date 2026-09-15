import type { ProviderDocType, ProviderRow } from "@/lib/supabase/types";

/**
 * The shape of an artisan application.
 *
 * Four steps, and the order is an argument rather than an arbitrary sequence.
 *
 * Asking for a Ghana Card first is how you lose an applicant: the artisan has
 * given you nothing yet, so the request reads as intrusive. Trades first costs
 * one tap, gives them something invested, and — because the draft `providers`
 * row already exists from signup — every step after it saves independently.
 * Somebody can start on a bus, lose signal, and pick up where they stopped.
 *
 * Money before documents is deliberate too. "Where should we pay you" is the
 * step that reframes the whole form as a job application rather than a
 * background check, and it lands better immediately before the intrusive part
 * than immediately after it.
 *
 * `provider_application_gaps()` in migration 0008 is what actually decides
 * whether this can be submitted. Everything here is presentation: which screen
 * to draw, and whether to put a tick next to it.
 */

export const APPLICATION_STEPS = [
  {
    key: "trades",
    href: "trades",
    label: "Your trades",
    /** Shown under the step heading. Says what the step is *for*, not what it contains. */
    blurb: "The work you want to be called for.",
  },
  {
    key: "about",
    href: "about",
    label: "About you",
    blurb: "What a client sees before they accept your quote.",
  },
  {
    key: "payout",
    href: "payout",
    label: "Getting paid",
    blurb: "Where your money goes when a job is signed off.",
  },
  {
    key: "documents",
    href: "documents",
    label: "Proof of identity",
    blurb: "The part that makes you a verified artisan.",
  },
  {
    key: "review",
    href: "review",
    label: "Send for review",
    blurb: "Check it over, then it goes to our team.",
  },
] as const;

export type ApplicationStepKey = (typeof APPLICATION_STEPS)[number]["key"];

export function stepIndex(key: ApplicationStepKey): number {
  return APPLICATION_STEPS.findIndex((step) => step.key === key);
}

/** Minimum bio length. Mirrors the 40-character floor in `provider_application_gaps`. */
export const MIN_BIO_LENGTH = 40;
export const MAX_BIO_LENGTH = 600;

/** `GHA-#########-#`. Mirrors the `providers_ghana_card_format` constraint. */
const GHANA_CARD_PATTERN = /^GHA-\d{9}-\d$/;

export function isValidGhanaCardNumber(input: string): boolean {
  return GHANA_CARD_PATTERN.test(input.trim().toUpperCase());
}

/**
 * Formats keystrokes into `GHA-123456789-0` as the artisan types.
 *
 * Worth the code: the number is printed on the card with the dashes, so a field
 * that silently wants them omitted — or silently wants them included — produces
 * a rejection for a data-entry reason on a form whose entire purpose is to
 * establish trust.
 */
export function formatGhanaCardNumber(input: string): string {
  const digits = input.toUpperCase().replace(/[^0-9]/g, "").slice(0, 10);
  if (digits.length === 0) return input.trim() === "" ? "" : "GHA-";
  if (digits.length <= 9) return `GHA-${digits}`;
  return `GHA-${digits.slice(0, 9)}-${digits.slice(9)}`;
}

export const SPOKEN_LANGUAGES = [
  "English",
  "Twi",
  "Ga",
  "Ewe",
  "Hausa",
  "Dagbani",
  "Fante",
] as const;

/**
 * Service radius options, in kilometres.
 *
 * Discrete choices rather than a free number, because the honest answer is a
 * judgement about traffic rather than a measurement, and because these are the
 * same bands the matcher widens through (PLAN.md §6).
 */
export const SERVICE_RADIUS_OPTIONS = [5, 10, 20, 30] as const;

export interface ApplicationState {
  provider: ProviderRow;
  tradeCount: number;
  docTypes: ProviderDocType[];
}

/**
 * Whether each step has enough in it to count as done.
 *
 * Deliberately the same conditions as the SQL, restated in TypeScript rather
 * than fetched, because this runs on every render of the stepper and a round
 * trip per render to draw a tick is not a trade worth making. The SQL is the
 * gate; if the two ever disagree the artisan sees a tick and is still refused,
 * which is why `review` reads the server's answer instead of guessing.
 */
export function stepCompletion(state: ApplicationState): Record<ApplicationStepKey, boolean> {
  const { provider, tradeCount, docTypes } = state;

  const hasAllIdDocs =
    docTypes.includes("ghana_card_front") &&
    docTypes.includes("ghana_card_back") &&
    docTypes.includes("selfie");

  return {
    trades: tradeCount > 0,
    about:
      (provider.bio?.trim().length ?? 0) >= MIN_BIO_LENGTH &&
      provider.years_experience !== null &&
      (provider.base_city?.trim().length ?? 0) > 0,
    payout: Boolean(provider.momo_number && provider.momo_network),
    documents: hasAllIdDocs && Boolean(provider.ghana_card_number),
    review: false,
  };
}

/**
 * Which step to drop somebody on when they tap "continue my application".
 *
 * The first unfinished one, or the review screen if everything is done. Sending
 * a returning artisan back to step one to tap through what they already filled
 * in is the most common way a multi-step form loses the person halfway.
 */
export function resumeStep(state: ApplicationState): ApplicationStepKey {
  const done = stepCompletion(state);
  const next = APPLICATION_STEPS.find((step) => step.key !== "review" && !done[step.key]);
  return next?.key ?? "review";
}

/** 0–1, for the progress rail. `review` is not counted — it is not work. */
export function applicationProgress(state: ApplicationState): number {
  const done = stepCompletion(state);
  const workSteps = APPLICATION_STEPS.filter((step) => step.key !== "review");
  const complete = workSteps.filter((step) => done[step.key]).length;
  return complete / workSteps.length;
}
