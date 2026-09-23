"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The reference's "Explore our Services" tabs: a row of labels with a navy
 * underline that slides between them.
 *
 * **Why the reference's own tabs are not here.** It offers All / Popular /
 * Near you / Top rated / Offers / Recommended. Five of those six need data
 * ArtisanGH does not collect: there is no popularity rollup per trade, no
 * proximity index, no per-trade rating (ratings attach to artisans, and
 * artisans are matched rather than browsed — PLAN.md §14), and no offers at all
 * (§14 puts promo codes out of v1). Shipping six tabs where five sort the same
 * list the same way is a control that lies six times.
 *
 * So this is the *component*, built to the reference's spec and ready for those
 * tabs the day the data exists, driven by whatever segments the caller can
 * actually fill. Today the client home passes two, and only when the second has
 * something in it.
 *
 * **The indicator slides rather than fades.** Equal-width columns mean the
 * position is `index * 100%` of one column — no measurement, no refs, no
 * resize observer, and it translates to React Native unchanged. A fading
 * underline reads as two separate underlines blinking; a sliding one reads as
 * one object moving, which is what tells you the sections are alternatives.
 *
 * Panels are kept mounted and hidden rather than unmounted: switching back is
 * then instant and scroll position inside a panel survives.
 */
export interface Segment {
  id: string;
  label: string;
  content: React.ReactNode;
}

export function SegmentedSection({
  segments,
  label,
  className,
}: {
  segments: Segment[];
  /** Names the tablist for screen readers — "Explore services", say. */
  label: string;
  className?: string;
}) {
  const [active, setActive] = React.useState(0);
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // A single segment is not a choice. Render the content bare rather than a
  // one-tab tablist, which announces as a control that cannot be operated.
  if (segments.length < 2) {
    return <div className={className}>{segments[0]?.content}</div>;
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();

    // Wraps at both ends, which is what the WAI-ARIA tabs pattern specifies and
    // what a thumb on a four-tab row expects.
    const next = (active + delta + segments.length) % segments.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="relative grid border-b border-hairline"
        style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
      >
        {segments.map((segment, index) => {
          const selected = index === active;
          return (
            <button
              key={segment.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`tab-${segment.id}`}
              aria-selected={selected}
              aria-controls={`panel-${segment.id}`}
              // Roving tabindex: one stop for the whole row, then arrow keys.
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={cn(
                "min-h-11 px-2 pb-3 text-note font-semibold",
                "transition-colors duration-[var(--duration-fast)] ease-out-strong",
                selected ? "text-navy-900" : "text-copy-muted hover:text-navy-800",
              )}
            >
              {segment.label}
            </button>
          );
        })}

        {/* The indicator. One column wide, translated by whole columns. */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-navy-800 transition-transform duration-[var(--duration-base)] ease-out-strong"
          style={{
            width: `${100 / segments.length}%`,
            transform: `translateX(${active * 100}%)`,
          }}
        />
      </div>

      {segments.map((segment, index) => (
        <div
          key={segment.id}
          role="tabpanel"
          id={`panel-${segment.id}`}
          aria-labelledby={`tab-${segment.id}`}
          hidden={index !== active}
          className="pt-4"
        >
          {segment.content}
        </div>
      ))}
    </div>
  );
}
