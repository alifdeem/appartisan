import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A large, tappable, selectable card — icon, title, supporting line, and a
 * selection indicator on the right.
 *
 * Presentational only: it renders whatever element the caller gives it through
 * `render`, so the same visual can be a radio on the signup screen and a plain
 * button elsewhere without this file knowing about either. That matters because
 * the semantics are the part most likely to be got wrong — a set of `<button>`s
 * where exactly one may be chosen is a radio group wearing a costume, and a
 * screen reader will announce it as five unrelated buttons.
 *
 * **The check is drawn, not faded.** `check-draw` runs the stroke on from its
 * own path length while `check-pop` springs the disc in behind it, so selecting
 * a card looks like the choice being *written down*. A check that fades in
 * looks like it was always there and you just noticed.
 */
export function OptionCard({
  selected,
  icon,
  title,
  subtitle,
  className,
  children,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  className?: string;
  /** The interactive element — a hidden radio, typically. */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-3.5 rounded-[1.25rem] border p-4",
        "transition-[border-color,background-color,box-shadow] duration-[var(--duration-fast)] ease-out-strong",
        // The press lands on the whole card. 0.985 rather than 0.98 because a
        // full-width card travels further at the same scale than a small button
        // does, and the same number reads as twice the movement.
        "active:scale-[0.985] active:transition-none",
        // The interactive element is a visually-hidden radio, so the focus ring
        // has to be lifted onto the card the eye can actually see. Without this
        // the card is perfectly keyboard-operable and completely invisible to a
        // keyboard user.
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-azure-500 has-[:focus-visible]:ring-offset-2",
        selected
          ? "border-azure-500 bg-azure-50/60 shadow-[var(--shadow-float)]"
          : "border-hairline bg-white hover:border-azure-300",
        className,
      )}
    >
      {children}

      <span
        aria-hidden
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-[0.875rem] [&_svg]:size-[1.375rem]",
          "transition-colors duration-[var(--duration-fast)]",
          selected ? "bg-azure-100 text-navy-800" : "bg-azure-50 text-navy-700",
        )}
      >
        {icon}
      </span>

      {/* `min-w-0` is load-bearing: without it a flex child refuses to shrink
          below its content's intrinsic width, and the subtitle pushes the
          selection mark off the right edge at 360px instead of wrapping. */}
      <span className="min-w-0 flex-1">
        <span className="block font-space text-[1.0625rem] font-bold text-navy-900">{title}</span>
        <span className="mt-0.5 block text-note text-copy-muted">{subtitle}</span>
      </span>

      <SelectionMark selected={selected} />
    </div>
  );
}

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full",
        "transition-[background-color,border-color] duration-[var(--duration-fast)] ease-out-strong",
        selected ? "bg-azure-500" : "border-2 border-hairline bg-white",
      )}
    >
      {selected && (
        <svg viewBox="0 0 24 24" className="size-3.5 animate-check-pop" fill="none" aria-hidden>
          <path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke="white"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            // 20 is this path's own length, which is what `check-draw`
            // counts down from. Change the path and this changes with it.
            strokeDasharray={20}
            className="animate-check-draw"
          />
        </svg>
      )}
    </span>
  );
}
