"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { callAction } from "@/lib/action-call";

import { setAvailabilityAction } from "@/app/(app)/provider/actions";
import { cn } from "@/lib/utils";
import type { ProviderAvailability } from "@/lib/supabase/types";

/**
 * Online / offline.
 *
 * This is the most consequential control an artisan touches: it is the only
 * thing that decides whether the matcher can see them, so every decision below
 * is about making its state unmistakable from arm's length rather than about
 * making it elegant.
 *
 * **Why it is a slab and not a switch.** PLAN.md §11 commits the provider side
 * to large colour-coded states rather than paragraphs, and the person using this
 * is outdoors, one-handed, often holding something. A 51×31pt iOS switch is a
 * control you have to look at twice to read. A full-width block whose entire
 * background answers the question can be read while walking.
 *
 * **Why the state is optimistic and then corrected.** The artisan taps and the
 * slab moves immediately; the RPC answers a few hundred milliseconds later with
 * the availability the database actually settled on, and that value wins. The
 * alternative — waiting for the round trip — puts a spinner on the one control
 * that must feel instant. The alternative to *correcting* is worse: a toggle
 * reading "Online" over a row that says otherwise is an artisan waiting all
 * afternoon for offers that are going to somebody else.
 *
 * **Why `on_job` is a separate, locked state rather than a disabled toggle.**
 * "You cannot change this" and "you are working" are different sentences. The
 * second one is information; the first is an obstruction.
 */

export function AvailabilityToggle({
  availability,
  canGoOnline,
  /** Why not, when they cannot. Shown in place of the hint. */
  blockedReason,
}: {
  availability: ProviderAvailability;
  canGoOnline: boolean;
  blockedReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  /**
   * The optimistic value, tagged with the server value it was derived from.
   *
   * Tagging rather than clearing it in an effect: when the server's prop
   * arrives, "is my guess still relevant?" is answered during render. The
   * effect version commits the stale guess for a frame and then replaces it,
   * which on this component is a visible flash of the wrong colour.
   */
  const [guess, setGuess] = React.useState<{ from: ProviderAvailability; to: boolean } | null>(null);

  const shown: ProviderAvailability =
    guess && guess.from === availability ? (guess.to ? "online" : "offline") : availability;

  const onJob = availability === "on_job";
  const isOnline = shown === "online";
  const locked = onJob || (!canGoOnline && !isOnline);

  function toggle() {
    if (locked || pending) return;

    const next = !isOnline;
    setGuess({ from: availability, to: next });

    startTransition(async () => {
      const result = await callAction(() => setAvailabilityAction(next));

      if (!result.ok) {
        setGuess(null);
        toast.error(result.error ?? "Could not change your availability.");
        return;
      }

      // The row is authoritative. Pull it and let the tag above retire the
      // guess on the next render.
      router.refresh();
    });
  }

  return (
    /**
     * The reference's status card: **white, quiet, and green when live** — not
     * the navy slab this was before.
     *
     * The earlier version made going online the loudest object on the screen,
     * which was a reasonable instinct and the wrong one for this composition.
     * The hero already carries the weight; a second full-bleed gradient beside
     * the photograph fought it and flattened the band. Here the state is told
     * by a dot and a colour, and the only chrome is one soft shadow.
     *
     * Three states, still read from colour before any word is: **green** live,
     * **azure** locked on a job, **slate** off.
     */
    <div
      className={cn(
        "rounded-[1.125rem] bg-white p-3.5 shadow-[var(--shadow-float)]",
        "transition-colors duration-[var(--duration-base)] ease-out-strong",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={locked}
        aria-pressed={isOnline}
        aria-label={isOnline ? "Go offline" : "Go online"}
        className={cn(
          "flex w-full items-center gap-3 text-left",
          // 130ms, resolving before the finger lifts — anything slower reads as
          // lag rather than as feedback.
          "transition-transform duration-[var(--duration-instant)] ease-out-strong",
          locked ? "cursor-default" : "active:scale-[0.99]",
        )}
      >
        <span className="relative grid size-6 shrink-0 place-items-center">
          {pending ? (
            <Loader2 className="size-4 animate-spin text-copy-muted" aria-hidden />
          ) : onJob ? (
            <Lock className="size-4 text-azure-600" aria-hidden />
          ) : (
            <>
              {/* The only moving thing on the screen, and only while genuinely
                  live — so it reads as a status light, not decoration. */}
              {isOnline && (
                <span className="absolute inline-flex size-5 animate-pulse-ring rounded-full bg-success-500/45" />
              )}
              <span
                className={cn(
                  "relative size-2.5 rounded-full",
                  isOnline ? "bg-success-600" : "bg-hairline",
                )}
              />
            </>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-ui leading-tight font-semibold",
              onJob ? "text-azure-700" : isOnline ? "text-success-700" : "text-navy-900",
            )}
          >
            {onJob ? "On a job" : isOnline ? "You\u2019re online" : "You\u2019re offline"}
          </span>
          <span className="mt-0.5 block text-2xs leading-snug text-copy-muted">
            {onJob
              ? "Finish the job you\u2019re on to change this."
              : isOnline
                ? "Jobs near you are being offered"
                : (blockedReason ?? "Go online to start receiving jobs")}
          </span>
        </span>

        {!locked && (
          <span
            aria-hidden
            className={cn(
              "relative h-7 w-[3rem] shrink-0 rounded-full",
              "transition-colors duration-[var(--duration-base)] ease-out-strong",
              isOnline ? "bg-azure-500" : "bg-hairline",
            )}
          >
            <span
              className={cn(
                "absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm",
                // transform, not `left` — this runs on the GPU and cannot
                // trigger layout on a phone that is already struggling.
                "transition-transform duration-[var(--duration-base)] ease-out-strong",
                isOnline ? "translate-x-[1.25rem]" : "translate-x-0",
              )}
            />
          </span>
        )}
      </button>
    </div>
  );
}
