"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Where you are in posting a job.
 *
 * A layout cannot see the pathname, so the active step is resolved here rather
 * than threaded through every page as a prop — one source, no chance of a page
 * and its own indicator disagreeing.
 *
 * Completed steps are not links. The draft is saved on each advance, so going
 * back is legitimate and the browser's own back button does it; turning the
 * rail into navigation invites a client to jump to "Review" from step one and
 * meet a validation error they had no way to anticipate.
 */
const STEPS = [
  { segment: "describe", label: "Describe" },
  { segment: "location", label: "Location" },
  { segment: "review", label: "Review" },
] as const;

export function PostSteps() {
  const pathname = usePathname();
  const current = Math.max(
    0,
    STEPS.findIndex((step) => pathname.endsWith(`/${step.segment}`)),
  );

  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li key={step.segment} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                "transition-colors duration-[var(--duration-base)] ease-out-strong",
                done && "bg-brand-600 text-white",
                active && "bg-brand-700 text-white",
                !done && !active && "bg-ink-200 text-ink-500",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : index + 1}
            </span>

            <span
              className={cn(
                "text-xs font-medium sm:text-sm",
                active ? "text-ink-900" : "text-ink-500",
              )}
            >
              {step.label}
            </span>

            {index < STEPS.length - 1 && (
              <span
                className={cn(
                  "ml-1 hidden h-px flex-1 sm:block",
                  done ? "bg-brand-300" : "bg-ink-200",
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
