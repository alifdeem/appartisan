import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The decorative layer the auth screens sit on.
 *
 * The brief's architecture rule — *do not bake UI into images* — is why this is
 * a component and not a PNG. Everything here is a flat blue shape or a gradient,
 * which means a raster version would cost a megabyte, blur on a 3x screen, need
 * a second file for the 360px case, and still have to be re-exported the first
 * time the navy moves half a step. As SVG it is about 1KB, it is sharp at every
 * density, it reads the palette from the same tokens the buttons do, and it
 * costs nothing on a metered Accra connection.
 *
 * Photographs are the opposite case and stay photographs — see `AuthHero` and
 * `AuthFooterScene`, which composite *over* this.
 *
 * Every layer here is `aria-hidden` and `pointer-events-none`. A decorative
 * shape that can take a tap is a dead zone the user cannot see.
 */

/**
 * The organic blue shapes. Two large, soft, overlapping forms bleeding off the
 * right edge, plus a wash at the bottom.
 *
 * They are `preserveAspectRatio="none"` on a stretched viewBox on purpose: these
 * are not a picture, they are a wash, and letting them distort to the viewport
 * keeps the composition identical at 360 and 430 instead of sliding the shapes
 * across the text as the screen narrows.
 */
/**
 * The shape layer is blurred, and heavily — 56px.
 *
 * Unblurred, a filled path has a hard edge, and a hard edge is a *shape*: at
 * 40% opacity on a pale ground it draws a visible arc straight through whatever
 * text it passes behind, which on the login screen is the headline. The brief
 * asks for soft organic forms and that adjective is the entire specification.
 *
 * The layer is inset past its own bounds (`-inset-20`, sized to match) because
 * a blur samples transparency from outside the element: flush to the edges it
 * would fade the shapes out at all four sides and draw a pale halo just inside
 * the frame. Oversizing pushes that artefact outside the clip.
 *
 * Cost is a one-time composite. The layer never animates, never scrolls
 * independently and never repaints, so this is not the `backdrop-filter` on a
 * scrolling surface that the service circles deliberately avoid.
 */
const SHAPE_LAYER =
  "absolute -inset-20 h-[calc(100%+10rem)] w-[calc(100%+10rem)] blur-[56px]";

export function AuthBackdrop({
  variant,
  className,
}: {
  /** `login` weights the shapes to the top-right behind the hero; `signup` runs them down the right edge and pools at the foot. */
  variant: "login" | "signup";
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden bg-canvas select-none",
        className,
      )}
    >
      {/* Base wash — a very slight vertical lift so the screen is not one flat
          fill. Barely visible by design; you notice its absence, not its
          presence. */}
      <div className="absolute inset-0 bg-linear-to-b from-white via-canvas to-azure-50/50" />

      {variant === "login" ? (
        <svg
          viewBox="0 0 390 844"
          preserveAspectRatio="none"
          className={SHAPE_LAYER}
          fill="none"
        >
          {/* Upper-right form, bleeding off two edges so it reads as a crop of
              something larger rather than as a shape placed on the page. It is
              kept clear of the headline's measure on purpose — the portrait
              lands inside it, and the text must never have to compete with
              either. */}
          <path
            d="M236 -80c86 0 168 44 214 120 46 76 46 186-8 252-54 66-162 92-250 66-88-26-156-104-150-194 6-90 108-244 194-244Z"
            className="fill-azure-200/40"
          />
          {/* A second, smaller, slightly deeper form inside the first. Two
              shapes at different opacities is what turns a flat fill into
              depth; one shape at any opacity is a blob. */}
          <path
            d="M318 -30c54 24 82 96 72 162-10 66-58 124-122 138-64 14-142-22-162-88-20-66 22-158 82-198 60-40 76-38 130-14Z"
            className="fill-azure-300/38"
          />
          {/* Bottom-left counterweight, under the card. Navy rather than more
              azure — it ties the foot of the screen to the button and stops the
              whole composition leaning right. */}
          <path
            d="M-110 690c62-42 168-28 220 20 52 48 52 134 8 182-44 48-144 60-212 28-68-32-78-188-16-230Z"
            className="fill-navy-200/28"
          />
        </svg>
      ) : (
        <svg
          viewBox="0 0 390 844"
          preserveAspectRatio="none"
          className={SHAPE_LAYER}
          fill="none"
        >
          {/* Right-edge ribbon running most of the height. Narrow by design:
              this screen is a long column of content, so the decoration has to
              stay out of the text's way for 700px at a stretch. */}
          <path
            d="M392 -40c-52 78-74 190-56 286 18 96 74 178 60 268-14 90 0 150 0 190h94V-40h-98Z"
            className="fill-azure-200/40"
          />
          <path
            d="M406 130c-38 56-54 136-42 206 12 70 50 128 42 192-8 64 0 104 0 130h84V130h-84Z"
            className="fill-azure-300/34"
          />
          {/* The pool at the foot, beneath the skyline band. */}
          <path
            d="M-40 726c94-34 188 16 268 30 80 14 138-14 202-30v158H-40V726Z"
            className="fill-navy-200/26"
          />
        </svg>
      )}
    </div>
  );
}

/**
 * The white fade that separates the background layer from the UI layer.
 *
 * This is the "soft white fade overlay" in the brief, and it is one element for
 * one reason: photographs of people have hard edges and the composition needs
 * them not to. It sits above the portrait and below the card, so the artisan
 * dissolves into the page rather than being cut out of it — and, incidentally,
 * so that any text that ends up over the image still has something to sit on.
 *
 * `from-white via-white/70` rather than `from-white to-transparent`: a linear
 * fade to transparent has a visible band about a third of the way up, because
 * alpha is linear and perceived lightness is not. The extra stop bends it.
 */
export function WhiteFade({
  direction = "up",
  className,
}: {
  direction?: "up" | "down";
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0",
        direction === "up"
          ? "bg-linear-to-t from-white from-15% via-white/70 via-55% to-transparent"
          : "bg-linear-to-b from-white from-10% via-white/60 via-50% to-transparent",
        className,
      )}
    />
  );
}
