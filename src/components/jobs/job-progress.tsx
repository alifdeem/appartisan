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
 *
 * **Two grounds, one component.** On the job screen this rail sits inside the
 * navy status hero; elsewhere it could sit on white. Rather than two rails that
 * drift apart, the colours are a lookup keyed on `on`. Everything else — the
 * geometry, the tick, the wrap behaviour — is shared, which is the part that is
 * actually fiddly.
 *
 * **Labels wrap rather than truncate.** At 360px the content column is about
 * 320px inside the hero's padding, which is 64px per step; "Artisan found" does
 * not fit on one line at 11px and never will. A second line costs 14px of
 * height once. Truncating to "Artisan fou…" costs the reader the word.
 */
export function JobProgress({
  status,
  on = "light",
  className,
}: {
  status: JobStatus;
  /** The ground this sits on. `dark` = inside the navy hero. */
  on?: "light" | "dark";
  className?: string;
}) {
  const current = milestoneIndex(status);
  if (current < 0) return null;

  const dark = on === "dark";

  return (
    <ol className={cn("flex items-start", className)} aria-label="Progress">
      {CLIENT_MILESTONES.map((milestone, index) => {
        const done = index < current;
        const active = index === current;
        const reached = done || active;

        return (
          <li key={milestone.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex w-full items-center">
              {/* The two half-connectors. The first step's left half and the
                  last step's right half are hidden rather than absent, so
                  every dot is centred over its own label — with them absent,
                  the end dots sit against the edge and the labels drift. */}
              <Connector filled={done || active} dark={dark} hidden={index === 0} />

              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full",
                  "transition-colors duration-[var(--duration-base)] ease-out-strong",
                  done && (dark ? "bg-white text-azure-700" : "bg-navy-800 text-white"),
                  // The current step is the brightest thing on the rail, with
                  // a halo around it. It was a dark disc inside a thin ring,
                  // which on navy is the one combination that reads as *less*
                  // prominent than the finished steps beside it — the eye went
                  // to the white ticks and skipped the state the job is in.
                  active &&
                    (dark
                      ? "bg-white ring-4 ring-white/30"
                      : "bg-azure-500 ring-4 ring-azure-500/20"),
                  !reached && (dark ? "bg-white/25" : "bg-hairline"),
                )}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      active
                        ? dark
                          ? "bg-azure-700"
                          : "bg-white"
                        : dark
                          ? "bg-white/55"
                          : "bg-white",
                    )}
                    aria-hidden
                  />
                )}
              </span>

              <Connector
                filled={done}
                dark={dark}
                hidden={index === CLIENT_MILESTONES.length - 1}
              />
            </div>

            <span
              className={cn(
                "px-0.5 text-center text-2xs leading-tight text-balance",
                active
                  ? cn("font-bold", dark ? "text-white" : "text-navy-900")
                  : dark
                    ? "font-medium text-white/85"
                    : "text-copy-muted",
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

function Connector({
  filled,
  dark,
  hidden,
}: {
  filled: boolean;
  dark: boolean;
  hidden: boolean;
}) {
  return (
    <span className={cn("h-0.5 flex-1", hidden && "opacity-0")} aria-hidden>
      <span
        className={cn(
          "block h-full w-full rounded-full transition-colors duration-[var(--duration-base)]",
          filled ? (dark ? "bg-white" : "bg-navy-800") : dark ? "bg-white/30" : "bg-hairline",
        )}
      />
    </span>
  );
}
