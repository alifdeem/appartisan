import { cn } from "@/lib/utils";

/**
 * Placeholder wordmark.
 *
 * The client has no brand yet (PLAN.md §15), so this is intentionally simple:
 * a geometric mark that reads at 20px on a cracked phone screen and can be
 * swapped for their real logo by replacing this one file. Nothing else in the
 * app draws the mark.
 */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-[0.5rem] bg-brand-700 shadow-sm"
      >
        {/* A chevron and a spark — "someone is on the way". */}
        <svg viewBox="0 0 24 24" className="size-5" fill="none" strokeWidth={2.25}>
          <path
            d="M6 13.5 10.5 18 18.5 7"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="18.5" cy="7" r="2.25" className="fill-accent-400" />
        </svg>
      </span>
      {showWordmark && (
        <span className="text-[1.0625rem] font-semibold tracking-tight text-ink-900">
          Artisan<span className="text-brand-700">GH</span>
        </span>
      )}
    </span>
  );
}
