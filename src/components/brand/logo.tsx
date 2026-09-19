import { cn } from "@/lib/utils";

/**
 * Placeholder wordmark.
 *
 * The client has no brand yet (PLAN.md §15), so this is intentionally simple:
 * a geometric mark that reads at 20px on a cracked phone screen and can be
 * swapped for their real logo by replacing this one file. Nothing else in the
 * app draws the mark.
 */
/**
 * `lg` exists for the splash screen, where the lockup is the only thing on the
 * page and the header's 32px mark reads as an icon that failed to load.
 */
const SIZES = {
  md: { box: "size-8 rounded-[0.5rem]", glyph: "size-5", word: "text-lede" },
  lg: { box: "size-12 rounded-[0.75rem]", glyph: "size-7", word: "text-title-sm" },
} as const;

export function Logo({
  className,
  showWordmark = true,
  size = "md",
}: {
  className?: string;
  showWordmark?: boolean;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];

  return (
    <span className={cn("inline-flex items-center", size === "lg" ? "gap-3" : "gap-2", className)}>
      <span
        aria-hidden
        className={cn("grid shrink-0 place-items-center bg-brand-700 shadow-sm", s.box)}
      >
        {/* A chevron and a spark — "someone is on the way". */}
        <svg viewBox="0 0 24 24" className={s.glyph} fill="none" strokeWidth={2.25}>
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
        <span className={cn("font-semibold tracking-tight text-ink-900", s.word)}>
          Artisan<span className="text-brand-700">GH</span>
        </span>
      )}
    </span>
  );
}
