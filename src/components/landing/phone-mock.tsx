import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * A phone, drawn in the DOM, with a real screenshot inside it.
 *
 * **Why not one flattened image of both phones.** A composite PNG is fixed at
 * one resolution, so it is either soft on a retina display or enormous; it
 * cannot restack for a narrow screen, so the mobile view becomes a crop of a
 * picture of two phones; and the screenshots inside go stale the moment a
 * dashboard changes, silently. Built from markup, the frame stays vector-crisp
 * at any density, the screens are `next/image` served at the size actually
 * needed, and `scripts/tmp/hero-shots.ts` can regenerate them from the running
 * app whenever the product moves.
 *
 * **No notch, no home indicator, no imitation of a specific handset.** The
 * moment a frame copies one manufacturer it dates itself, and it invites the
 * question of why the other platform is missing. This is a device-shaped
 * object: a rounded rect, a dark bezel, a lit edge.
 *
 * The screenshots are 1170x2532, so the aspect is locked to that and the image
 * is never asked to stretch.
 */

/** The shot's own aspect, so nothing is ever squashed to fit a guess. */
const ASPECT = 1170 / 2532;

export function PhoneMock({
  src,
  alt,
  priority = false,
  className,
  sizes,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  /** Width lives here, as responsive utilities. See the note below. */
  className?: string;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-[2.25rem] bg-navy-950 p-[0.4rem]",
        // The lit edge. An inner highlight along the top and a hairline all
        // round: without them the bezel is a black hole rather than an object
        // with a surface catching the light behind it.
        "shadow-[0_2px_0_0_rgba(255,255,255,0.14)_inset,0_0_0_1px_rgba(255,255,255,0.10)]",
        className,
      )}
      /**
       * Aspect only. Width belongs to `className`.
       *
       * The first version took a numeric `width` prop and set it inline
       * alongside the aspect ratio, while the caller also passed
       * `w-[150px] sm:w-[190px]`. An inline style beats a class, so both
       * phones stayed at their desktop width at every breakpoint, the pair
       * overflowed a 390px viewport, and the hero's headline was clipped off
       * the right edge of the page.
       */
      style={{ aspectRatio: String(ASPECT) }}
    >
      {/* The screen. `overflow-hidden` on the inner element rather than the
          frame, so the frame's highlight is not clipped by its own corner. */}
      <div className="relative h-full w-full overflow-hidden rounded-[1.9rem] bg-white">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover object-top"
        />
      </div>
    </div>
  );
}
