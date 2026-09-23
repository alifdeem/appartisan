import * as React from "react";

/**
 * The primary action, pinned to the bottom of the viewport.
 *
 * Every screen in the posting reference ends this way: content scrolls, the
 * action does not move. Rules §4 — "primary actions that the reference pins to
 * the bottom of the viewport stay pinned".
 *
 * `position: fixed`, not `sticky`. Sticky has no React Native equivalent and
 * the rules rule it out; a fixed bar maps onto a bottom-docked view directly.
 * It is constrained to the same `max-w-[26rem]` column as the app shell so on a
 * desktop window it sits under the phone column rather than stretching across
 * the whole browser.
 *
 * The gradient above it is doing real work: content scrolling underneath a
 * hard-edged bar gets guillotined mid-line, and the fade is what tells the eye
 * there is more below rather than that the page ended.
 *
 * **Every screen using this owns `pb-32`.** The bar is out of flow and cannot
 * reserve its own space — the same contract the tab bar already has with
 * `pb-28`.
 */
export function StickyAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[26rem] print:hidden">
      <div aria-hidden className="h-8 bg-linear-to-t from-white to-transparent" />
      {/* pb-6 clears the iOS home indicator without a safe-area query, which RN
          handles through its own inset API anyway. */}
      <div className="bg-white px-5 pt-1 pb-6">{children}</div>
    </div>
  );
}
