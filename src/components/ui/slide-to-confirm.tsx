"use client";

import * as React from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Check, ChevronsRight, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Slide to confirm.
 *
 * Adapted from `radiumcoders/slide-to-detonate` on 21st.dev. The drag mechanics
 * and the spring settle are theirs; what follows is what had to change to be
 * shippable here, and each one is a real defect in the original for this use:
 *
 *  1. **It was drag-only.** WCAG 2.2 AA (2.5.7, Dragging Movements) requires a
 *     single-pointer alternative for any author-controlled drag. The handle is
 *     now a real `<button>`: Enter, Space and ArrowRight confirm it without any
 *     dragging at all, and it is reachable by tab. A control that decides
 *     whether somebody earns today cannot be gated behind a gesture.
 *  2. **It reset itself after 1.6 seconds.** Here, confirming fires a server
 *     action and then navigates. A control that springs back to "slide to
 *     accept" while the accept is still in flight invites a second attempt on
 *     a job that has already been taken.
 *  3. **No pending state.** `respondToOfferAction` is a network round trip on a
 *     Ghanaian mobile connection. The track now locks and shows a spinner, so
 *     the wait is legible rather than looking like the slide did not take.
 *  4. **Distance only, no velocity.** A confident flick that stops at 80% was
 *     rejected and sprang back, which reads as the control refusing you. It now
 *     also fires on velocity — the same rule a swipe-to-dismiss uses.
 *  5. **shadcn tokens and a Radix button** it assumed we have. Neither exists
 *     in this project; this uses our own tokens and a plain button.
 *
 * `dragElastic={0}` is kept from the original: this is a commitment gate, and
 * rubber-banding past the end would suggest there is somewhere further to go.
 */

const HANDLE = 44;
const TRACK_PADDING = 4;

/** px/s. A flick faster than this confirms wherever it stopped. */
const FLICK_VELOCITY = 900;
/** …provided it got at least this far, so a stray swipe cannot accept a job. */
const FLICK_MIN_PROGRESS = 0.45;

export function SlideToConfirm({
  label,
  confirmingLabel = "Working…",
  confirmedLabel,
  onConfirm,
  pending = false,
  disabled = false,
  threshold = 0.92,
  tone = "navy",
  className,
}: {
  label: string;
  confirmingLabel?: string;
  confirmedLabel: string;
  onConfirm: () => void;
  /** True while the caller's action is in flight. Locks the track. */
  pending?: boolean;
  disabled?: boolean;
  /** Fraction of the track that counts as a deliberate slide. */
  threshold?: number;
  tone?: "navy" | "success";
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [range, setRange] = React.useState(0);
  const [armed, setArmed] = React.useState(false);

  const x = useMotionValue(0);
  const progress = useTransform(() => (range > 0 ? x.get() / range : 0));
  const labelOpacity = useTransform(progress, [0, 0.55], [1, 0]);
  // The fill follows the handle, so the track reads as being consumed rather
  // than as a knob moving along a groove.
  const fillWidth = useTransform(progress, (p) => `${Math.max(0, Math.min(1, p)) * 100}%`);

  const measure = React.useCallback(() => {
    const node = trackRef.current;
    if (!node) return;
    setRange(node.clientWidth - HANDLE - TRACK_PADDING * 2);
  }, []);

  React.useEffect(() => {
    measure();
    const node = trackRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  const locked = disabled || pending || armed;

  function settle(to: number) {
    if (reduceMotion) {
      x.set(to);
      return;
    }
    animate(x, to, { type: "spring", stiffness: 500, damping: 38 });
  }

  function confirm() {
    if (locked) return;
    setArmed(true);
    // Snap to the end rather than spring: the decision is made, and a bounce
    // here would read as the control still being in play.
    x.set(range);
    onConfirm();
  }

  return (
    <div
      ref={trackRef}
      data-state={armed ? "confirmed" : "idle"}
      className={cn(
        "relative flex h-13 w-full items-center overflow-hidden rounded-full select-none",
        "border border-hairline bg-azure-50",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {/* The consumed portion of the track. */}
      <motion.span
        aria-hidden
        style={{ width: reduceMotion && !armed ? undefined : fillWidth }}
        className={cn(
          "absolute inset-y-0 left-0 rounded-full",
          tone === "success"
            ? "bg-linear-to-r from-success-600 to-success-700"
            : "bg-linear-to-r from-navy-800 to-navy-900",
          armed && "w-full",
        )}
      />

      <motion.span
        aria-hidden
        style={armed ? undefined : { opacity: labelOpacity }}
        className={cn(
          "pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 pl-10 text-note font-semibold",
          armed ? "text-white" : "text-navy-800",
        )}
      >
        {armed && (pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />)}
        {armed ? (pending ? confirmingLabel : confirmedLabel) : label}
      </motion.span>

      {/**
       * A real button, not a div. This is the single-pointer and keyboard path
       * the WCAG criterion requires, and it costs nothing — the same element is
       * the drag handle.
       */}
      <motion.button
        type="button"
        aria-label={label}
        disabled={disabled || pending}
        drag={locked ? false : "x"}
        dragConstraints={{ left: 0, right: range }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={(_event, info) => {
          if (locked || range <= 0) return;

          const travelled = x.get() / range;
          const flicked = info.velocity.x > FLICK_VELOCITY && travelled > FLICK_MIN_PROGRESS;

          if (travelled >= threshold || flicked) confirm();
          else settle(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " " || event.key === "ArrowRight") {
            event.preventDefault();
            confirm();
          }
        }}
        style={{ x }}
        className={cn(
          "absolute top-1 left-1 z-20 grid size-11 place-items-center rounded-full",
          "bg-white text-navy-800 shadow-md",
          "focus-visible:ring-4 focus-visible:ring-azure-500/30 focus-visible:outline-none",
          !locked && "cursor-grab active:cursor-grabbing",
          locked && "cursor-default",
        )}
      >
        {armed ? <Check className="size-5" /> : <ChevronsRight className="size-5" />}
      </motion.button>
    </div>
  );
}
