import { Activity, AlertTriangle } from "lucide-react";

import type { ReliabilityStats } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * The artisan's own reliability figures.
 *
 * PLAN.md §8: "Artisans see their own reliability stats in their dashboard.
 * Hiding the score and then punishing people for it is how you lose supply."
 * So this shows the same numbers the sweep scores, including the thresholds
 * they are measured against — an artisan who can see they are at two
 * cancellations knows not to make a third.
 *
 * Below the offer floor it says so plainly rather than rendering 0% and letting
 * somebody think they are failing. Nothing is scored until there is enough
 * history to score.
 */

function Figure({
  label,
  value,
  detail,
  warn = false,
}: {
  label: string;
  value: string;
  detail?: string;
  warn?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-2xs font-semibold tracking-[0.08em] text-copy-muted uppercase">
        {label}
      </p>
      <p
        className={cn(
          "tabular font-mono text-xl font-semibold",
          warn ? "text-danger-700" : "text-navy-900",
        )}
      >
        {value}
      </p>
      {detail && <p className="text-2xs text-copy-muted">{detail}</p>}
    </div>
  );
}

export function ReliabilityPanel({ stats }: { stats: ReliabilityStats }) {
  if (!stats.scored) {
    return (
      <section className="rounded-[1.25rem] border border-hairline bg-white p-4">
        <div className="flex items-start gap-2.5">
          <Activity className="mt-0.5 size-4 shrink-0 text-azure-500" aria-hidden />
          <div>
            <h2 className="font-space text-note font-bold text-navy-900">Your reliability</h2>
            <p className="mt-0.5 text-note leading-relaxed text-copy-muted">
              You have had {stats.offers} offer{stats.offers === 1 ? "" : "s"} in the last{" "}
              {stats.window_days} days. Scoring starts once you have had a few more, so an early
              quiet week never counts against you.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-[1.25rem] border border-hairline bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-space text-note font-bold text-navy-900">Your reliability</h2>
          <p className="mt-0.5 text-sm text-copy-muted">
            Rolling {stats.window_days} days. These decide how often you are offered work.
          </p>
        </div>
        <Activity className="size-4 shrink-0 text-copy-muted" aria-hidden />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure
          label="Accepted"
          value={stats.accept_rate === null ? "-" : `${stats.accept_rate}%`}
          detail={`${stats.accepted} of ${stats.offers} offers`}
          warn={stats.accept_rate !== null && stats.accept_rate < 40}
        />
        <Figure
          label="Rating"
          value={stats.rating_count === 0 ? "-" : stats.rating_avg.toFixed(2)}
          detail={`${stats.rating_count} rated job${stats.rating_count === 1 ? "" : "s"}`}
          warn={stats.rating_count >= 5 && stats.rating_avg < 3}
        />
        <Figure
          label="Cancelled"
          value={String(stats.cancels)}
          detail="after accepting"
          warn={stats.cancels >= 2}
        />
        <Figure
          label="No-shows"
          value={String(stats.no_shows)}
          detail="accepted, never set out"
          warn={stats.no_shows >= 1}
        />
      </div>

      {(stats.cancels >= 2 || stats.no_shows >= 1) && (
        <p className="flex items-start gap-2 rounded-field bg-warning-50 px-3 py-2 text-sm text-warning-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          One more and your account goes to an administrator for review. If something is going
          wrong, call us before it does.
        </p>
      )}
    </section>
  );
}
