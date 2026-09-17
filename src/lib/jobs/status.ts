import type { JobStatus } from "@/lib/supabase/types";

/**
 * How each job status is spoken to a client.
 *
 * The enum is the state machine's vocabulary (PLAN.md §6), not the user's.
 * `quote_rejections` and `expired_no_match` are precise and correct and mean
 * nothing to someone whose tap is leaking, so every status gets a plain-English
 * label and a sentence saying what is happening and who is being waited on.
 *
 * Two rules the copy follows, both from PLAN.md:
 *
 *  • **A declined quote is not a failure.** It sends the job back to matching by
 *    design, and with no price guidance in v1 it will be a common path. It
 *    reads as "finding you another artisan", never as an error.
 *  • **Say who we are waiting for.** A silent spinner is the single most
 *    expensive UI in a marketplace; "we've contacted 3 so far" is the whole
 *    difference between patience and a phone call to support.
 *
 * `tone` maps onto the Badge tones, and follows the design rule that amber is
 * money and nothing else — so a status is only ever `money` when the client owes
 * something.
 */

export type JobStatusGroup = "draft" | "active" | "closed";

export interface JobStatusPresentation {
  /** Two or three words. Fits a badge on a 360px screen. */
  label: string;
  tone: "neutral" | "brand" | "money" | "success" | "warning" | "danger" | "info";
  /** One sentence, addressed to the client, present tense. */
  blurb: string;
  group: JobStatusGroup;
  /** True while the platform or an artisan owes the client an action. */
  awaitingUs: boolean;
}

export const JOB_STATUS: Record<JobStatus, JobStatusPresentation> = {
  draft: {
    label: "Draft",
    tone: "neutral",
    blurb: "Not posted yet — finish the details and we'll start looking.",
    group: "draft",
    awaitingUs: false,
  },
  posted: {
    label: "Posted",
    tone: "info",
    blurb: "Your request is in. We're lining up artisans near you.",
    group: "active",
    awaitingUs: true,
  },
  matching: {
    label: "Finding an artisan",
    tone: "info",
    blurb: "We're contacting verified artisans nearest to you, one at a time.",
    group: "active",
    awaitingUs: true,
  },
  offer_sent: {
    label: "Artisan deciding",
    tone: "info",
    blurb: "An artisan has your job in front of them right now.",
    group: "active",
    awaitingUs: true,
  },
  unmatched: {
    label: "Still looking",
    tone: "warning",
    blurb: "Nobody nearby was free. Our team is calling artisans for you directly.",
    group: "active",
    awaitingUs: true,
  },
  assigned: {
    label: "Artisan assigned",
    tone: "brand",
    blurb: "An artisan has taken your job and is preparing a price.",
    group: "active",
    awaitingUs: true,
  },
  quote_pending: {
    label: "Price being prepared",
    tone: "brand",
    blurb: "Your artisan is itemising the work. You'll approve the price before anyone travels.",
    group: "active",
    awaitingUs: true,
  },
  quote_sent: {
    label: "Price ready",
    tone: "money",
    blurb: "Your artisan has sent a price. Nothing happens until you accept it.",
    group: "active",
    awaitingUs: false,
  },
  awaiting_deposit: {
    label: "Deposit due",
    tone: "money",
    blurb: "Pay the deposit and your artisan sets off.",
    group: "active",
    awaitingUs: false,
  },
  deposit_paid: {
    label: "Deposit paid",
    tone: "success",
    blurb: "Payment received. Your artisan is getting ready to travel.",
    group: "active",
    awaitingUs: true,
  },
  en_route: {
    label: "On the way",
    tone: "brand",
    blurb: "Your artisan is travelling to you.",
    group: "active",
    awaitingUs: true,
  },
  arrived: {
    label: "Arrived",
    tone: "brand",
    blurb: "Your artisan is at your address.",
    group: "active",
    awaitingUs: true,
  },
  in_progress: {
    label: "Work under way",
    tone: "brand",
    blurb: "The job has started.",
    group: "active",
    awaitingUs: true,
  },
  work_complete: {
    label: "Work finished",
    tone: "info",
    blurb: "Your artisan has marked the job done and uploaded photos.",
    group: "active",
    awaitingUs: false,
  },
  awaiting_signoff: {
    label: "Needs your sign-off",
    tone: "warning",
    blurb: "Check the work and sign it off while your artisan is still with you.",
    group: "active",
    awaitingUs: false,
  },
  awaiting_balance: {
    label: "Balance due",
    tone: "money",
    blurb: "Approve the mobile money prompt to settle the balance.",
    group: "active",
    awaitingUs: false,
  },
  paid: {
    label: "Paid",
    tone: "success",
    blurb: "Paid in full. Your receipt is on the job.",
    group: "active",
    awaitingUs: false,
  },
  closed: {
    label: "Completed",
    tone: "success",
    blurb: "This job is finished and closed.",
    group: "closed",
    awaitingUs: false,
  },
  cancelled_by_client: {
    label: "Cancelled",
    tone: "neutral",
    blurb: "You cancelled this request.",
    group: "closed",
    awaitingUs: false,
  },
  cancelled_by_provider: {
    label: "Artisan cancelled",
    tone: "warning",
    blurb: "Your artisan had to pull out. Anything you paid has been refunded in full.",
    group: "closed",
    awaitingUs: false,
  },
  expired_no_match: {
    label: "No artisan found",
    tone: "danger",
    blurb: "We couldn't find anyone available for this one. Nothing was charged.",
    group: "closed",
    awaitingUs: false,
  },
  disputed: {
    label: "In dispute",
    tone: "danger",
    blurb: "Our team is looking into this job with you.",
    group: "closed",
    awaitingUs: false,
  },
};

export function jobStatus(status: JobStatus): JobStatusPresentation {
  return JOB_STATUS[status];
}

/**
 * The cancellation tiers from PLAN.md §7, as the UI sees them.
 *
 * Kept in step with `cancel_job` (migration 0012), which is what actually
 * enforces them. Two lists rather than one because the difference matters to
 * the person cancelling: walking away before paying costs nothing and needs no
 * explanation, whereas cancelling after a deposit triggers a refund and is
 * worth saying out loud before they tap.
 */

/** Nothing has been paid, so nothing is owed and nothing comes back. */
export const FREELY_CANCELLABLE: readonly JobStatus[] = [
  "draft",
  "posted",
  "matching",
  "offer_sent",
  "unmatched",
  "assigned",
  "quote_pending",
  "quote_sent",
  "awaiting_deposit",
];

/**
 * Paid, but nobody has travelled yet — so the deposit comes back in full.
 *
 * This is clean only because the platform holds the gross and pays artisans
 * separately (PLAN.md §4 Finding 1). Under a split-payment model every one of
 * these refunds would leave the platform out of pocket.
 */
export const REFUNDABLE_CANCELLABLE: readonly JobStatus[] = ["deposit_paid"];

export function isCancellable(status: JobStatus): boolean {
  return FREELY_CANCELLABLE.includes(status) || REFUNDABLE_CANCELLABLE.includes(status);
}

/** True when cancelling now returns money the client has already paid. */
export function cancellingRefunds(status: JobStatus): boolean {
  return REFUNDABLE_CANCELLABLE.includes(status);
}

/**
 * The client-facing arc, used to draw a progress rail on the job screen.
 * Deliberately shorter than the enum — a client does not need to see
 * `offer_sent` and `assigned` as separate milestones, only "we're finding
 * someone" then "they're on the way".
 */
export const CLIENT_MILESTONES = [
  { key: "requested", label: "Requested" },
  { key: "matched", label: "Artisan found" },
  { key: "priced", label: "Price agreed" },
  { key: "working", label: "Work done" },
  { key: "settled", label: "Paid" },
] as const;

export type ClientMilestone = (typeof CLIENT_MILESTONES)[number]["key"];

const MILESTONE_BY_STATUS: Record<JobStatus, ClientMilestone | null> = {
  draft: null,
  posted: "requested",
  matching: "requested",
  offer_sent: "requested",
  unmatched: "requested",
  assigned: "matched",
  quote_pending: "matched",
  quote_sent: "matched",
  awaiting_deposit: "priced",
  deposit_paid: "priced",
  en_route: "priced",
  arrived: "priced",
  in_progress: "priced",
  work_complete: "working",
  awaiting_signoff: "working",
  awaiting_balance: "working",
  paid: "settled",
  closed: "settled",
  cancelled_by_client: null,
  cancelled_by_provider: null,
  expired_no_match: null,
  disputed: null,
};

/** Index into CLIENT_MILESTONES, or -1 for statuses off the happy path. */
export function milestoneIndex(status: JobStatus): number {
  const key = MILESTONE_BY_STATUS[status];
  if (!key) return -1;
  return CLIENT_MILESTONES.findIndex((m) => m.key === key);
}
