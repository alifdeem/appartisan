"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

import { APPLICATION_STEPS, type ApplicationStepKey } from "@/lib/providers/application";
import { cn } from "@/lib/utils";

/**
 * Where you are in the artisan application.
 *
 * **These steps are links, and the job-posting rail's steps are not.** That
 * looks like an inconsistency and is the opposite: posting a job is one sitting
 * with a validated hand-off at each step, so jumping to "Review" would meet an
 * error you had no way to anticipate. An application is filled in over days,
 * out of order, with a photograph taken when somebody finds their card. A
 * returning artisan knows exactly which one thing is missing, and making them
 * tap through four finished screens to reach it is the single most reliable way
 * to lose them.
 *
 * Every step saves independently, so there is nothing to lose by leaving one.
 *
 * Two renderings of the same list: a vertical rail with the reasons attached on
 * a wide screen, and a bar with one line of text on a phone. Not a scaled-down
 * version of the rail — five labelled dots at 360px are five unreadable dots.
 */

export function ApplicationSteps({
  completion,
}: {
  completion: Record<ApplicationStepKey, boolean>;
}) {
  const pathname = usePathname();
  const currentIndex = Math.max(
    0,
    APPLICATION_STEPS.findIndex((step) => pathname.endsWith(`/${step.href}`)),
  );
  const current = APPLICATION_STEPS[currentIndex];

  const workSteps = APPLICATION_STEPS.filter((step) => step.key !== "review");
  const doneCount = workSteps.filter((step) => completion[step.key]).length;

  return (
    <>
      {/* ---- phone ---- */}
      <div className="space-y-2.5 lg:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-ink-900">{current.label}</p>
          <p className="tabular font-mono text-xs text-ink-500">
            {currentIndex + 1}/{APPLICATION_STEPS.length}
          </p>
        </div>

        <div className="h-1 overflow-hidden rounded-full bg-ink-200">
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-[var(--duration-slow)] ease-out-strong"
            style={{ width: `${(doneCount / workSteps.length) * 100}%` }}
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={workSteps.length}
            aria-label="Application progress"
          />
        </div>
      </div>

      {/* ---- wide ---- */}
      <ol className="hidden lg:block lg:space-y-0.5" aria-label="Application steps">
        {APPLICATION_STEPS.map((step, index) => {
          const done = completion[step.key];
          const active = index === currentIndex;

          return (
            <li key={step.key}>
              <Link
                href={`/provider/apply/${step.href}`}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex items-start gap-3 rounded-field px-3 py-2.5",
                  "transition-colors duration-[var(--duration-fast)] ease-out-strong",
                  active ? "bg-ink-0 shadow-xs" : "hover:bg-ink-0/70",
                )}
              >
                <span
                  className={cn(
                    "mt-px grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    "transition-colors duration-[var(--duration-base)] ease-out-strong",
                    done
                      ? "bg-brand-600 text-white"
                      : active
                        ? "bg-brand-700 text-white"
                        : "bg-ink-200 text-ink-500",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : index + 1}
                </span>

                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      active ? "text-ink-900" : "text-ink-700",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink-500">
                    {step.blurb}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}
