import { jobStatus } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/supabase/types";

/**
 * A job's state, in the client's language.
 *
 * **Why this no longer renders `<Badge>`.** `Badge` is built on the warm `ink`
 * ramp — `bg-ink-100`, `bg-brand-50`, `bg-info-50` — which is correct in the
 * admin console and wrong on every screen of the 2026 redesign, where the
 * ground is pure white and the palette is navy and azure. This badge appears on
 * five redesigned screens (client home, job history, the artisan's job list and
 * both job screens), so it was the one warm object left sitting in the middle
 * of them. `Badge` itself is untouched and still serves the console.
 *
 * The tone map is the interesting part. Six of the seven tones move into the
 * cool system; **`money` stays amber**, because the app has exactly one rule
 * about amber and it is that amber means money. A deposit due is the one status
 * a client owes something on, and it should not look like every other state.
 *
 * The live states keep their pulsing dot. It is doing real work: "Finding an
 * artisan" and "No artisan found" are both small text, and without motion a
 * client on a stalled screen cannot tell at a glance whether anything is still
 * happening. The dot is the difference between waiting and wondering.
 */

const TONES: Record<ReturnType<typeof jobStatus>["tone"], string> = {
  neutral: "border border-hairline bg-white text-copy-muted",
  brand: "bg-navy-50 text-navy-800",
  info: "bg-azure-50 text-azure-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  money: "bg-accent-50 text-accent-800",
};

export function JobStatusBadge({
  status,
  className,
}: {
  status: JobStatus;
  className?: string;
}) {
  const presentation = jobStatus(status);
  const live = presentation.group === "active" && presentation.awaitingUs;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1",
        "text-2xs leading-none font-semibold whitespace-nowrap",
        TONES[presentation.tone],
        className,
      )}
    >
      {live && (
        <span className="relative flex size-1.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-current" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {presentation.label}
    </span>
  );
}

/**
 * The same state, on a dark surface.
 *
 * The tinted pills above vanish against navy — `bg-azure-50` on `navy-900` is a
 * pale rectangle with unreadable text inside it. On the status hero the badge
 * is a frosted chip instead, which keeps one shape for "this is the state"
 * without asking seven tints to work on two opposite grounds.
 */
export function JobStatusBadgeInverse({
  status,
  className,
}: {
  status: JobStatus;
  className?: string;
}) {
  const presentation = jobStatus(status);
  const live = presentation.group === "active" && presentation.awaitingUs;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1",
        "text-2xs leading-none font-semibold whitespace-nowrap text-white",
        className,
      )}
    >
      {live && (
        <span className="relative flex size-1.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-success-500" />
          <span className="relative inline-flex size-1.5 rounded-full bg-success-500" />
        </span>
      )}
      {presentation.label}
    </span>
  );
}
