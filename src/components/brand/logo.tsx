import { cn } from "@/lib/utils";

/**
 * The ArtisanGH lockup.
 *
 * Redrawn for the 2026 reference (`designing-ui-ux/`). Three things changed and
 * each was a decision rather than a restyle:
 *
 *  • **The box is gone.** The old mark was a glyph inside a filled rounded
 *    square, which is an app-icon, not a logo — correct on a home screen,
 *    wrong inside a page where it reads as a button nobody can press.
 *  • **Navy and azure, not green.** The mark is the one element that must be
 *    identical on every screen while the app migrates page by page, so it
 *    leads the migration rather than trailing it.
 *  • **Two tones, one letterform.** The A is cut into a navy left leg and an
 *    azure right leg with a hairline of white between them. That split is the
 *    whole mark: it reads as light falling across a solid object, which is the
 *    cheapest possible way to make a flat SVG feel dimensional, and it survives
 *    being scaled to 20px on a cracked screen because it is two big shapes and
 *    not a detail.
 *
 * Still the only place the mark is drawn — swapping the client's real logo in
 * is still this one file.
 */
const SIZES = {
  sm: { glyph: "size-7", word: "text-ui", tagline: "text-[0.5rem] tracking-[0.14em]" },
  md: { glyph: "size-9", word: "text-lede", tagline: "text-[0.5625rem] tracking-[0.15em]" },
  lg: { glyph: "size-12", word: "text-title", tagline: "text-2xs tracking-[0.16em]" },
} as const;

export function Logo({
  className,
  showWordmark = true,
  tagline = false,
  size = "md",
}: {
  className?: string;
  showWordmark?: boolean;
  /** "SKILLED PEOPLE. REAL SOLUTIONS." — the auth screens set it, chrome does not. */
  tagline?: boolean;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        aria-hidden
        className={cn("shrink-0", s.glyph)}
        fill="none"
        role="presentation"
      >
        {/* The mark is one lambda split down its axis, not two separate legs.
            Drawn as halves of a single letterform the apex, the inner notch and
            the baseline all land on the same geometry — which is why the two
            tones read as one object lit from the right rather than as two
            shapes that happen to be adjacent.

            The 1.6-unit gap at the axis is the whole trick: at 28px it is a
            hairline of white that separates the tones, and at 20px it closes up
            and the mark simply reads as a solid A. It degrades in the right
            direction. */}
        <path d="M15.2 2v13L8.4 31H0.6L15.2 2Z" className="fill-navy-800" />
        <path d="M16.8 2 31.4 31h-7.8L16.8 15V2Z" className="fill-azure-500" />
      </svg>

      {showWordmark && (
        <span className="inline-flex flex-col justify-center">
          <span
            className={cn(
              "font-space font-bold tracking-[-0.02em] text-navy-900 leading-none",
              s.word,
            )}
          >
            Artisan<span className="text-azure-500">GH</span>
          </span>
          {tagline && (
            <span className={cn("mt-1 font-medium text-copy-muted uppercase", s.tagline)}>
              Skilled people. Real solutions.
            </span>
          )}
        </span>
      )}
    </span>
  );
}
