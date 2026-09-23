"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Where you are in posting a job.
 *
 * A layout cannot see the pathname, so the active step is resolved here rather
 * than threaded through every page as a prop — one source, no chance of a page
 * and its own indicator disagreeing.
 *
 * **Three bars, not three numbered circles.** The rail sits directly under the
 * trade chip on a screen whose whole job is to hold one question at a time, and
 * a row of numbered nodes with labels and connectors is more chrome than the
 * form beneath it. Bars say the same thing — how far along, how much left — in
 * a quarter of the height, which is the reference's own instinct on these
 * screens. The step is still named in text beside the count, so it is not
 * carried by the bars alone.
 *
 * Completed steps are not links. The draft is saved on each advance, so going
 * back is legitimate and the browser's own back button does it; turning the
 * rail into navigation invites a client to jump to "Review" from step one and
 * meet a validation error they had no way to anticipate.
 */
const STEPS = [
  { segment: "describe", label: "Describe the job" },
  { segment: "schedule", label: "When suits you" },
  { segment: "location", label: "Where it is" },
  { segment: "review", label: "Check and post" },
] as const;

export function PostSteps() {
  const pathname = usePathname();
  const current = Math.max(
    0,
    STEPS.findIndex((step) => pathname.endsWith(`/${step.segment}`)),
  );

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-note font-semibold text-navy-900">{STEPS[current].label}</p>
        <p className="tabular font-mono text-2xs text-copy-muted">
          {current + 1} of {STEPS.length}
        </p>
      </div>

      {/* `aria-hidden`: the line above already states the position in words, and
          a screen reader reading out three unlabelled bars adds nothing. */}
      <ol aria-hidden className="flex items-center gap-1.5">
        {STEPS.map((step, index) => (
          <li
            key={step.segment}
            className={cn(
              "h-1 flex-1 rounded-full",
              "transition-colors duration-[var(--duration-base)] ease-out-strong",
              index <= current ? "bg-navy-800" : "bg-hairline",
            )}
          />
        ))}
      </ol>
    </div>
  );
}
