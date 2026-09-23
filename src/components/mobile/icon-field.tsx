import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The 2026 reference's form field: a soft-bordered box on white with a muted
 * icon on the left, the value in the middle, and an optional control on the
 * right.
 *
 * **Why a third field primitive.** `ui/input.tsx` is the dense boxed field for
 * the admin console and the quote builder. `mobile/underline-field.tsx` is the
 * label-above-hairline field from the previous reference. This one is different
 * from both in the thing that matters: it lives *inside a floating card*, where
 * there is no page structure around it to separate one control from the next,
 * so the box has to supply that separation itself — and it carries an icon,
 * which is what lets the field drop its label entirely and still be readable.
 * The label lives in the placeholder and the `aria-label`, exactly as the
 * mockup sets it.
 *
 * **Focus is on the box, not the input.** The reference's focus state is an
 * azure border with a soft bloom around it — the "blue focus ring, subtle glow"
 * in the brief. That has to be `focus-within` on the wrapper, because the
 * visible box and the focusable element are not the same node.
 *
 * The bloom is `ring-4` at 12% rather than a `box-shadow` so it composites on
 * the GPU and does not repaint the card behind it on every focus change.
 */
export function IconField({
  icon,
  trailing,
  error,
  className,
  children,
}: {
  /** Leading glyph. Muted at rest, azure once the field has focus. */
  icon: React.ReactNode;
  /** Right slot — the country flag, a reveal toggle, a unit. */
  trailing?: React.ReactNode;
  error?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[0.875rem] border bg-white px-4",
        "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-out-strong",
        error
          ? "border-danger-500 focus-within:border-danger-600 focus-within:ring-4 focus-within:ring-danger-500/12"
          : "border-hairline focus-within:border-azure-500 focus-within:ring-4 focus-within:ring-azure-500/12",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center [&_svg]:size-[1.125rem]",
          "transition-colors duration-[var(--duration-fast)]",
          error ? "text-danger-500" : "text-copy-muted",
        )}
      >
        {icon}
      </span>

      {children}

      {trailing && <span className="flex shrink-0 items-center">{trailing}</span>}
    </div>
  );
}

/**
 * The control inside it. Transparent and unpadded — the box owns the frame, the
 * height and the horizontal rhythm.
 *
 * `text-base` is not a style choice: iOS Safari zooms the viewport whenever a
 * focused input is under 16px, and on a screen whose whole composition is a
 * centred card, that zoom throws the layout sideways mid-typing.
 */
export function IconFieldInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "min-h-[3.25rem] w-full min-w-0 bg-transparent text-base text-copy",
        "placeholder:text-copy-muted/70 focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
