import { BadgeCheck, Briefcase, Star, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ReliabilityStats, VerificationStatus } from "@/lib/supabase/types";

/**
 * "Your performance" — the four-stat row from the dashboard reference.
 *
 * The reference draws Average Rating, Completed Jobs, **On-time Rate** and
 * **Verification 100%**. Two of those four had to change, and neither for a
 * stylistic reason:
 *
 *  • **On-time rate does not exist.** Nothing in the schema records a promised
 *    arrival time, so there is nothing to be on time against — the number would
 *    be invented on a panel whose entire job is to be trusted. What *is*
 *    recorded, and what the matcher actually scores an artisan on, is their
 *    **accept rate** over the last 30 days (migration 0018). That is the number
 *    that changes how much work they are offered, so it is the one worth
 *    showing.
 *  • **Verification is not a percentage.** It is approved or it is not. "100%"
 *    implies a scale with partial states, and a rejected artisan reading "0%"
 *    would learn nothing about what to fix.
 *
 * **Completed jobs is all-time, and says so.** The reference labels it "this
 * month"; `providers.jobs_completed` is a lifetime counter and there is no
 * monthly rollup. Relabelling was cheaper and more honest than inventing one.
 *
 * A new artisan is **not scored**. Below the offer floor `reliability.scored`
 * is false, and a row of dashes on somebody's first week reads as a problem
 * with them rather than an absence of data — so that cell says what it means.
 */
export function PerformancePanel({
  ratingAvg,
  ratingCount,
  jobsCompleted,
  verification,
  reliability,
}: {
  ratingAvg: number;
  ratingCount: number;
  jobsCompleted: number;
  verification: VerificationStatus;
  reliability: ReliabilityStats | null;
}) {
  // Three reviews before an average is an average. One five-star job is not a
  // 5.0, and showing it as one sets an expectation the next client breaks.
  const rated = ratingCount >= 3;
  const scored = reliability?.scored === true && reliability.accept_rate !== null;

  return (
    /**
     * One module, not four columns — the reference divides the cells with
     * hairline rules inside a single surface rather than setting four cards
     * side by side, which is what makes it read as a dashboard panel.
     *
     * `divide-x` draws those rules between the cells and never outside them, so
     * there is no `:last-child` bookkeeping and no rule hanging off the end.
     */
    <section className="rounded-[1.25rem] bg-white p-4 shadow-[var(--shadow-float)]">
      {/* `text-balance` on the labels, and hints kept to two or three words:
          in a 93px column a five-word hint wraps to three lines and drags the
          whole panel out of line with its neighbours. */}
      <div className="grid grid-cols-4 divide-x divide-hairline">
        <Stat
          icon={<Star />}
          value={rated ? ratingAvg.toFixed(1) : "—"}
          label="Average rating"
          hint={rated ? `${ratingCount} review${ratingCount === 1 ? "" : "s"}` : "Not yet rated"}
        />
        <Stat
          icon={<Briefcase />}
          value={String(jobsCompleted)}
          label="Jobs completed"
          hint="All time"
        />
        <Stat
          icon={<TrendingUp />}
          value={scored ? `${Math.round((reliability.accept_rate ?? 0) * 100)}%` : "—"}
          label="Accept rate"
          hint={scored ? `Last ${reliability.window_days} days` : "Not yet scored"}
        />
        <Stat
          icon={<BadgeCheck />}
          value={verification === "approved" ? "Yes" : "No"}
          label="Verified"
          hint="Ghana Card"
          tone={verification === "approved" ? "good" : "warn"}
        />
      </div>
    </section>
  );
}

function Stat({
  icon,
  value,
  label,
  hint,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  hint: string;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-1 text-center">
      <span
        aria-hidden
        className={cn(
          "grid size-10 place-items-center rounded-full [&_svg]:size-5",
          tone === "good" && "bg-success-50 text-success-600",
          tone === "warn" && "bg-accent-50 text-accent-600",
          tone === "neutral" && "bg-azure-50 text-azure-600",
        )}
      >
        {icon}
      </span>
      <p className="tabular font-mono text-title-sm leading-none font-bold text-navy-900">
        {value}
      </p>
      <p className="text-2xs leading-tight font-medium text-balance text-navy-900/85">{label}</p>
      <p className="text-2xs leading-tight text-balance text-copy-muted/80">{hint}</p>
    </div>
  );
}
