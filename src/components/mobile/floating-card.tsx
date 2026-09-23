import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The white card the login form sits in.
 *
 * Three details carry the whole effect, and all three are easy to get almost
 * right:
 *
 *  • **32px corners** (`radius-sheet`). Large enough that the corner is a shape
 *    rather than a softened edge. At 16px this is a div; at 32px it is an
 *    object resting on the screen.
 *  • **A three-stop shadow**, not one. A contact shadow at 1px so the card has
 *    an edge, a mid shadow at 32px so it has lift, and a very wide, very faint
 *    one at 64px so the lift has somewhere to land. A single blurred shadow is
 *    the difference between "floating" and "smudged".
 *  • **A hairline top edge.** `border-white/80` catches the implied light from
 *    above, which is what stops the card dissolving into the pale ground it
 *    sits on. Without it the top corners visibly fade out.
 *
 * `overflow-hidden` is deliberately absent: the card overlaps the hero above it
 * and anything it contains — a focus ring, a pressed button's glow — needs to
 * be allowed outside the box.
 */
export function FloatingCard({
  children,
  className,
  as: Component = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  return (
    <Component
      className={cn(
        "rounded-sheet border border-white/80 bg-white",
        "shadow-[var(--shadow-sheet)]",
        "px-6 py-7",
        className,
      )}
    >
      {children}
    </Component>
  );
}
