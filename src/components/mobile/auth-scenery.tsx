import Image from "next/image";
import * as React from "react";

import { WhiteFade } from "@/components/mobile/auth-backdrop";
import { cn } from "@/lib/utils";

/**
 * The photographic plates on the auth screens.
 *
 * Both of these are *layers*, not pictures — they carry no text, no UI and no
 * shapes, and every one of them is optional. When the file is not on disk the
 * component renders nothing at all rather than a grey box: the coded backdrop
 * underneath is already a finished composition, so a missing photograph makes
 * these screens plainer, never broken. That is what lets the redesign ship
 * today and the photography land next week without a second commit.
 *
 * `aria-hidden` throughout with `alt=""`: the artisan in the corner is mood.
 * Announcing "photograph of a Ghanaian artisan looking upward" before the login
 * form is noise in front of the one thing the screen is for.
 */

/**
 * The login hero: a portrait bleeding off the top-right, masked into a soft
 * organic silhouette and faded out at its lower edge.
 *
 * The mask is a CSS radial gradient rather than an SVG `clipPath` because a
 * clip path has a hard edge — it would cut the photograph out with scissors,
 * which is exactly the "pasted on" look the fade exists to avoid. A gradient
 * mask feathers over ~25% of the shape, so the portrait *becomes* the blue wash
 * instead of sitting on it.
 */
export function AuthHero({ src, className }: { src: string | null; className?: string }) {
  if (!src) return null;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute select-none", className)}
      style={{
        // Two masks multiplied: an ellipse that rounds the silhouette, and a
        // vertical ramp that dissolves the bottom into the card below it.
        maskImage:
          "radial-gradient(115% 100% at 72% 30%, #000 42%, rgba(0,0,0,0.65) 68%, transparent 88%), linear-gradient(to bottom, #000 58%, transparent 96%)",
        maskComposite: "intersect",
        WebkitMaskImage:
          "radial-gradient(115% 100% at 72% 30%, #000 42%, rgba(0,0,0,0.65) 68%, transparent 88%), linear-gradient(to bottom, #000 58%, transparent 96%)",
        WebkitMaskComposite: "source-in",
      }}
    >
      <Image
        src={src}
        alt=""
        fill
        // The portrait is the largest paint on the screen and sits above the
        // fold, so it is the one image on this page worth blocking on.
        priority
        sizes="(max-width: 430px) 78vw, 330px"
        className="object-cover object-[60%_18%]"
      />
    </div>
  );
}

/**
 * The signup footer: a blue-tinted skyline with an artisan standing in front of
 * it, seen from behind.
 *
 * Two plates rather than one composited image, per the brief. It is not a
 * stylistic preference — the skyline is a wide, low, repeating band that has to
 * stretch to the viewport, while the figure is a fixed-proportion silhouette
 * that must never stretch. Baked together, one of the two is always wrong.
 * Apart, the skyline takes `object-cover` across the full width and the figure
 * keeps its own aspect ratio pinned to the right.
 */
export function AuthFooterScene({
  skyline,
  figure,
  className,
}: {
  skyline: string | null;
  figure: string | null;
  className?: string;
}) {
  if (!skyline && !figure) return null;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none relative h-44 w-full select-none", className)}
    >
      {skyline && (
        <Image
          src={skyline}
          alt=""
          fill
          sizes="(max-width: 430px) 100vw, 430px"
          // Anchored to the bottom so the waterline stays put and the sky is
          // what gets cropped as the band shortens.
          className="object-cover object-bottom opacity-90"
        />
      )}

      {/* The wave that ties the two plates together and hides the skyline's
          own horizon. Coded, so its colour tracks the palette. */}
      <svg
        viewBox="0 0 390 120"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-24 w-full"
        fill="none"
      >
        <path d="M0 62c92-34 168 22 250 6 82-16 110-34 140-44v96H0V62Z" className="fill-azure-300/45" />
        <path d="M0 92c104-28 150 14 232 2 82-12 118-26 158-34v60H0V92Z" className="fill-navy-400/35" />
      </svg>

      {figure && (
        <div className="absolute right-4 bottom-0 h-40 w-32">
          <Image src={figure} alt="" fill sizes="128px" className="object-contain object-bottom" />
        </div>
      )}

      {/* Feathers the top of the whole band into the page above it, so the
          scene arrives rather than starting. */}
      <WhiteFade direction="down" className="top-0 h-20" />
    </div>
  );
}
