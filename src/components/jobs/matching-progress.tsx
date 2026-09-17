"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Radar } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MatchingProgress as Progress } from "@/lib/jobs/matching";

/**
 * "Finding your artisan — we've contacted 3 so far."
 *
 * PLAN.md §6 names the silent spinner as the failure mode here, and it is not
 * an aesthetic point: with thin supply a plumbing job in Spintex at 8pm can
 * walk a short list, and the difference between a client waiting patiently and
 * a client phoning support is entirely whether the screen admits what it is
 * doing.
 *
 * So this shows real numbers — how many artisans have been asked, how far out
 * the search has reached, how long the one currently holding it has left. None
 * of it is decorative and none of it is invented; it all comes from
 * `job_matching_progress`, which returns the *shape* of the search without ever
 * exposing which artisans declined.
 *
 * **The rings are the one animated thing**, and they animate because widening
 * is the concept a client needs to grasp: we are not stuck, we are looking
 * further. Motion carries that where three static numbers would not.
 *
 * Polling refreshes the server component rather than fetching JSON, so when an
 * artisan accepts, this screen becomes the "artisan assigned" screen on its own
 * — no separate subscription, no second code path for the transition.
 */

const POLL_MS = 10_000;

export function MatchingProgress({
  progress,
  passCount = 3,
  /** Stop polling once the job is no longer being matched. */
  live = true,
}: {
  progress: Progress;
  passCount?: number;
  live?: boolean;
}) {
  const router = useRouter();

  React.useEffect(() => {
    if (!live) return;

    // A hidden tab is a tab nobody is waiting in front of. Polling it burns the
    // client's mobile data for a screen they cannot see.
    function poll() {
      if (document.visibilityState === "visible") router.refresh();
    }

    const timer = window.setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [router, live]);

  const { contacted, currentPass, radiusKm } = progress;

  return (
    <div className="overflow-hidden rounded-card border border-info-500/25 bg-info-50">
      <div className="flex items-center gap-4 p-4">
        {/* Concentric rings, one per matching pass. The active one pulses; the
            ones already walked are solid; the ones still to come are dashed.
            That reads as "we are here, and there is further to go" at a glance. */}
        <div className="relative grid size-16 shrink-0 place-items-center" aria-hidden>
          {Array.from({ length: passCount }, (_, index) => {
            const pass = index + 1;
            const walked = pass < currentPass;
            const active = pass === currentPass;
            const size = 40 + index * 12;

            return (
              <span
                key={pass}
                className={cn(
                  "absolute rounded-full border",
                  walked && "border-info-500/50",
                  active && "animate-pulse-ring border-info-600",
                  !walked && !active && "border-dashed border-info-500/25",
                )}
                style={{ width: size, height: size }}
              />
            );
          })}
          <Radar className="relative size-5 text-info-700" />
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[0.9375rem] leading-snug font-semibold text-ink-900">
            {live ? "Finding your artisan" : "Search paused"}
          </p>
          <p className="text-sm leading-snug text-ink-700">
            {contacted === 0 ? (
              <>Looking for verified artisans near you.</>
            ) : (
              <>
                We&rsquo;ve contacted{" "}
                <span className="tabular font-mono font-semibold text-ink-900">{contacted}</span>{" "}
                artisan{contacted === 1 ? "" : "s"} so far.
              </>
            )}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-info-500/15 border-t border-info-500/15 text-center">
        <Cell label="Contacted" value={String(contacted)} />
        <Cell label="Searching" value={`${radiusKm}km`} />
        <Cell label="Pass" value={`${currentPass} of ${passCount}`} />
      </dl>

      {/* Said plainly rather than hidden. A client who knows the search widens
          is a client who waits; one who thinks it is stuck calls support. */}
      <p className="border-t border-info-500/15 px-4 py-2.5 text-xs leading-relaxed text-ink-600">
        {currentPass < passCount
          ? "Each artisan gets two minutes to answer. If nobody nearby is free we widen the search automatically."
          : "We're looking as far as we go automatically. If nobody takes it, our team will call artisans for you directly."}
      </p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-2.5">
      <dt className="text-[0.625rem] font-medium tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className="tabular mt-0.5 font-mono text-sm font-semibold text-ink-900">{value}</dd>
    </div>
  );
}
