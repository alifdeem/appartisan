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
 * `bg-white` on both wrappers, not `ink-25`. The warm-paper ground argued in
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
  className,
}: {
  children: React.ReactNode;
  /** Bottom-pinned actions. */
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh justify-center bg-white">
      <div
        className={cn(
          "flex w-full max-w-[25rem] flex-col bg-white",
          // Only from lg — below that the column *is* the viewport and a border
          // would draw a line down the edge of the screen.
          "lg:border-x lg:border-ink-100",
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
