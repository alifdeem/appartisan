import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The shell every new-reference screen sits in.
 *
 * This product is designed once, for a phone: 390px is the design width, 360px
 * is the floor, and it is going to React Native later. So there is no desktop
 * layout — on a wide screen the same screen is simply centred, with hairlines
 * marking where the column ends so it reads as deliberate rather than as a page
 * that forgot to fill the window.
 *
 * `bg-white` on both wrappers, not `canvas`. The warm-paper ground argued in
 * DESIGN.md §3 is right for the marketing page and wrong here — the reference
 * grounds on white, and photographs of real rooms already supply all the warmth
 * these screens need.
 *
 * `footer` is where an action the reference pins to the bottom of the viewport
 * goes. It is laid out with `mt-auto` rather than `position: sticky` on purpose:
 * it puts the button at the bottom when the screen is short and directly after
 * the content when the screen is long, needs no magic numbers for the home
 * indicator, and is the one behaviour that translates to React Native unchanged.
 */
export function MobileScreen({
  children,
  footer,
  ground = "white",
  className,
}: {
  children: React.ReactNode;
  /** Bottom-pinned actions. */
  footer?: React.ReactNode;
  /**
   * The page ground.
   *
   * `white` is the default and what every screen built before the 2026 auth
   * reference uses. `canvas` is that reference's pale blue (#F8FBFF), and it
   * exists as a prop rather than a `className` override because the ground has
   * to be set on *both* wrappers: the outer one paints the gutters either side
   * of the column on a wide screen, and a column on canvas inside gutters on
   * white draws two visible seams down the page.
   */
  ground?: "white" | "canvas";
  className?: string;
}) {
  const bg = ground === "canvas" ? "bg-canvas" : "bg-white";

  return (
    <div className={cn("flex min-h-dvh justify-center", bg)}>
      <div
        className={cn(
          // `relative` so a screen can hang a decorative backdrop inside the
          // column — the shapes belong to the phone, not to the desktop gutters.
          "relative flex w-full max-w-[25rem] flex-col",
          bg,
          // Only from lg — below that the column *is* the viewport and a border
          // would draw a line down the edge of the screen.
          "lg:border-x lg:border-azure-50",
          className,
        )}
      >
        {children}

        {footer && (
          <div className="mt-auto px-6 pt-6 pb-8">
            {/* pb-8 clears the iOS home indicator without a safe-area query,
                which RN handles with its own inset API anyway. */}
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
