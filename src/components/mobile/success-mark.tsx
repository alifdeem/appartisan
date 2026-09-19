/**
 * The success mark: a shield with a check, and a scatter of dots around it.
 *
 * Inline SVG rather than a lucide icon because the reference's mark is a
 * filled shield with a thick stroked check and a deliberate confetti scatter —
 * three shapes, not one glyph. `currentColor` throughout so the whole thing
 * takes the brand ramp from its parent.
 *
 * The dots are decorative, so the svg is `aria-hidden` and the screen states
 * its outcome in text. An icon that needs a label is a label with extra steps.
 */
export function SuccessMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden>
      {/* Scatter. Sizes and positions are irregular on purpose — an even ring
          reads as a loading spinner rather than as celebration. */}
      <g fill="currentColor" opacity="0.55">
        <circle cx="23" cy="44" r="2.5" />
        <circle cx="34" cy="28" r="2" />
        <circle cx="52" cy="19" r="2.5" />
        <circle cx="70" cy="21" r="1.75" />
        <circle cx="86" cy="31" r="2.5" />
        <circle cx="96" cy="47" r="2" />
        <circle cx="16" cy="60" r="1.75" />
        <circle cx="103" cy="63" r="2.5" />
      </g>

      <path
        d="M60 32c-6.5 3.6-13.2 5.8-20.4 6.6v22.2c0 12.6 8.1 23.8 20.4 27.6 12.3-3.8 20.4-15 20.4-27.6V38.6C73.2 37.8 66.5 35.6 60 32Z"
        fill="currentColor"
      />
      <path
        d="m50.6 61.4 6.6 6.6 12.2-13"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
