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
 * the search has reached, which pass it is on. None of it is decorative and
 * none of it is invented; it all comes from `job_matching_progress`, which
 * returns the *shape* of the search without ever exposing which artisans
 * declined.
 *
 * **The rings are the one animated thing**, and they animate because widening
 * is the concept a client needs to grasp: we are not stuck, we are looking
 * further. Motion carries that where three static numbers would not.
 *
 * **It lives inside the status hero now, not in a card beneath it.** Matching
 * *is* the job's state while it is happening — a separate panel underneath said
 * the same thing twice, once in a sentence and once with a radar, and left the
 * reader deciding which one to believe.
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
    <div className="space-y-4">
      <div className="flex items-center gap-4">
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
                  walked && "border-white/60",
                  active && "animate-pulse-ring border-white",
                  !walked && !active && "border-dashed border-white/35",
                )}
                style={{ width: size, height: size }}
              />
            );
          })}
          <Radar className="relative size-5 text-white" />
        </div>

        <p className="min-w-0 flex-1 text-note leading-relaxed text-white/85">
          {contacted === 0 ? (
            <>Looking for verified artisans near you.</>
          ) : (
            <>
              We&rsquo;ve contacted{" "}
              <span className="tabular font-mono font-bold text-white">{contacted}</span> artisan
              {contacted === 1 ? "" : "s"} so far.
            </>
          )}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        <Cell label="Contacted" value={String(contacted)} />
        <Cell label="Searching" value={`${radiusKm}km`} />
        <Cell label="Pass" value={`${currentPass}/${passCount}`} />
      </dl>

      {/* Said plainly rather than hidden. A client who knows the search widens
          is a client who waits; one who thinks it is stuck calls support. */}
      <p className="text-2xs leading-relaxed text-white/85">
        {currentPass < passCount
          ? "Each artisan gets two minutes to answer. If nobody nearby is free we widen the search automatically."
          : "We're looking as far as we go automatically. If nobody takes it, our team will call artisans for you directly."}
      </p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] bg-white/15 px-2 py-2.5 text-center">
      <dt className="text-2xs font-medium tracking-[0.06em] text-white/85 uppercase">{label}</dt>
      <dd className="tabular mt-0.5 font-mono text-note font-bold text-white">{value}</dd>
    </div>
  );
}
