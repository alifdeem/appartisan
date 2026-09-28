"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The 120 seconds.
 *
 * This is the most consequential timer in the product, and almost every
 * decision in it is about *not* being a React component that re-renders.
 *
 * **The ring is pure CSS.** `animation: ring-drain <remaining>s linear` with a
 * negative `animation-delay` equal to the time already elapsed, so reopening
 * the screen at 0:42 resumes at 0:42 rather than restarting. It runs off the
 * main thread, which matters here more than anywhere else in the app: the offer
 * screen is loading a client's photographs at the same moment, and a
 * requestAnimationFrame timer would visibly stutter at precisely the instant
 * the artisan is deciding.
 *
 * **The digits are written to the DOM directly**, through a ref, by one
 * interval. 120 React renders to change two characters would be 120 chances to
 * re-render the photographs beneath them.
 *
 * **React is told exactly once** — when the clock reaches zero — because that
 * is the only moment the rest of the screen needs to change.
 *
 * `linear` is deliberate. A clock is constant motion; easing a countdown would
 * be a lie about how much time is left.
 */

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function format(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}

export function OfferCountdown({
  expiresAt,
  sentAt,
  onExpire,
  className,
}: {
  expiresAt: string;
  /**
   * When the offer went out. Without it the ring cannot be honest: an offer
   * reopened with 40 seconds left would draw a *full* ring draining over 40
   * seconds, telling the artisan they have more time than they do. With both
   * ends the animation is the real span with a negative delay into it.
   */
  sentAt: string;
  /** Fired once, when the clock runs out. */
  onExpire?: () => void;
  className?: string;
}) {
  const expiry = React.useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const digitsRef = React.useRef<HTMLSpanElement>(null);

  /**
   * Everything clock-derived is captured once, in a lazy initialiser.
   *
   * `Date.now()` is impure and must not be read while rendering; a ref read
   * during render is the same hazard wearing a different hat. A lazy
   * initialiser is the one sanctioned place to sample the wall clock, and it
   * runs exactly once per mount — which is precisely the semantics the CSS
   * animation needs, since re-computing these would restart the ring.
   *
   * Callers key this component by offer id, so a *new* offer is a new mount
   * rather than a prop change this would have to chase.
   */
  const [clock] = React.useState(() => {
    const now = Date.now();
    const start = new Date(sentAt).getTime();
    const total = Math.max(1, (expiry - start) / 1000);
    const elapsed = Math.min(total, Math.max(0, (now - start) / 1000));

    return { total, elapsed, remaining: Math.max(0, (expiry - now) / 1000) };
  });

  const [expired, setExpired] = React.useState(() => clock.remaining <= 0);

  React.useEffect(() => {
    if (expired) return;

    function tick() {
      const left = Math.max(0, (expiry - Date.now()) / 1000);

      // Straight to the text node. No setState, no reconciliation, no render.
      if (digitsRef.current) digitsRef.current.textContent = format(left);

      if (left <= 0) {
        setExpired(true);
        onExpire?.();
        return;
      }

      timer = window.setTimeout(tick, 250);
    }

    // 250ms rather than 1000ms: a clock polled exactly on the second drifts
    // visibly against the ring, because the two are driven by different clocks.
    // Four times a second costs nothing when the work is one text assignment.
    let timer = window.setTimeout(tick, 250);
    return () => window.clearTimeout(timer);
  }, [expiry, expired, onExpire]);

  return (
    <div
      className={cn("relative grid size-32 shrink-0 place-items-center", className)}
      role="timer"
      aria-label="Time left to respond"
    >
      <svg viewBox="0 0 120 120" className="absolute size-full -rotate-90" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="7"
          className="stroke-hairline"
        />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          className={cn(
            "ring-countdown",
            // Amber is money and nothing else in this system, so a draining
            // clock is brand green until it is genuinely urgent, then danger.
            // Never amber: this is not a price.
            expired ? "stroke-hairline" : "stroke-navy-800",
          )}
          style={
            {
              "--ring-length": CIRCUMFERENCE,
              // The animation is the offer's WHOLE span, entered part-way
              // through with a negative delay. That is what makes a reopened
              // offer resume at the right angle instead of restarting full.
              "--ring-duration": `${clock.total}s`,
              "--ring-delay": `-${clock.elapsed}s`,
              "--ring-static": CIRCUMFERENCE * (clock.elapsed / clock.total),
              ...(expired ? { strokeDashoffset: CIRCUMFERENCE } : null),
            } as React.CSSProperties
          }
        />
      </svg>

      <div className="relative text-center">
        <span
          ref={digitsRef}
          className="tabular block font-mono text-[1.75rem] leading-none font-semibold text-navy-900"
        >
          {format(clock.remaining)}
        </span>
        <span className="mt-1 block text-[0.6875rem] font-medium tracking-wide text-copy-muted uppercase">
          {expired ? "Expired" : "To decide"}
        </span>
      </div>
    </div>
  );
}
