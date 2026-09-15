import { Check } from "lucide-react";

import { CLIENT_MILESTONES, milestoneIndex } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/supabase/types";

/**
 * Where this job has got to, in five steps.
 *
 * The state machine has twenty-two states; a client needs five. Collapsing them
 * is the point — `offer_sent` and `assigned` are a meaningful distinction to the
 * matcher and noise to the person whose tap is leaking.
 *
 * Renders nothing for jobs off the happy path. A cancelled job showing a
 * half-filled progress rail reads as a system that has not noticed, which is
 * the opposite of reassuring.
 */
export function JobProgress({ status }: { status: JobStatus }) {
  const current = milestoneIndex(status);
  if (current < 0) return null;

  return (
    <ol className="flex items-start" role="list">
      {CLIENT_MILESTONES.map((milestone, index) => {
        const done = index < current;
        const active = index === current;
        const last = index === CLIENT_MILESTONES.length - 1;

        return (
          <li
            key={milestone.key}
            className={cn("flex min-w-0 flex-1 flex-col items-center gap-2", last && "flex-none")}
          >
            <div className="flex w-full items-center">
              {/* Spacer keeps the first dot centred over its own label. */}
              <div className={cn("h-0.5 flex-1", index === 0 ? "opacity-0" : "")} aria-hidden>
                <div className={cn("h-full w-full rounded-full", done || active ? "bg-brand-600" : "bg-ink-200")} />
              </div>

              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                  "duration-[var(--duration-base)] ease-out-strong",
                  done && "border-brand-600 bg-brand-600 text-white",
                  active && "border-brand-600 bg-ink-0 text-brand-700",
                  !done && !active && "border-ink-300 bg-ink-0",
                )}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      active ? "animate-pulse-ring bg-brand-600" : "bg-ink-300",
                    )}
                    aria-hidden
                  />
                )}
              </span>

              <div className={cn("h-0.5 flex-1", last && "opacity-0")} aria-hidden>
                <div className={cn("h-full w-full rounded-full", done ? "bg-brand-600" : "bg-ink-200")} />
              </div>
            </div>

            <span
              className={cn(
                "px-1 text-center text-[0.6875rem] leading-tight sm:text-xs",
                active ? "font-semibold text-ink-900" : "text-ink-500",
              )}
            >
              {milestone.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
