"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Power } from "lucide-react";
import { toast } from "sonner";

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
      const result = await setAvailabilityAction(next);

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
    <div
      className={cn(
        "overflow-hidden rounded-card border shadow-sm",
        "transition-colors duration-[var(--duration-base)] ease-out-strong",
        onJob
          ? "border-info-500/30 bg-info-50"
          : isOnline
            ? "border-success-500/35 bg-success-50"
            : "border-ink-200 bg-ink-0",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={locked}
        aria-pressed={isOnline}
        aria-label={isOnline ? "Go offline" : "Go online"}
        className={cn(
          "flex w-full items-center gap-4 p-4 text-left",
          "transition-transform duration-[var(--duration-instant)] ease-out-strong",
          locked ? "cursor-default" : "active:scale-[0.99]",
        )}
      >
        <span
          className={cn(
            "relative grid size-12 shrink-0 place-items-center rounded-full",
            "transition-colors duration-[var(--duration-base)] ease-out-strong",
            onJob
              ? "bg-info-500/15 text-info-700"
              : isOnline
                ? "bg-success-500/15 text-success-700"
                : "bg-ink-100 text-ink-500",
          )}
        >
          {/* The only moving thing on the screen, and only while genuinely
              live — so it reads as a status light rather than decoration. */}
          {isOnline && !pending && (
            <span className="absolute inline-flex size-12 animate-pulse-ring rounded-full bg-success-500/40" />
          )}
          {pending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : onJob ? (
            <Lock className="relative size-5" aria-hidden />
          ) : (
            <Power className="relative size-5" aria-hidden />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[1.0625rem] leading-tight font-semibold text-ink-900">
            {onJob ? "On a job" : isOnline ? "You're online" : "You're offline"}
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-ink-600">
            {onJob
              ? "Finish the job you're on to change this."
              : isOnline
                ? "Jobs near you will be offered to you."
                : (blockedReason ?? "Go online to start receiving jobs.")}
          </span>
        </span>

        {!locked && (
          /* A real switch, kept as the secondary affordance — the slab is the
             target, this is what tells you the slab is a toggle at all. */
          <span
            aria-hidden
            className={cn(
              "relative h-8 w-[3.25rem] shrink-0 rounded-full",
              "transition-colors duration-[var(--duration-base)] ease-out-strong",
              isOnline ? "bg-success-600" : "bg-ink-300",
            )}
          >
            <span
              className={cn(
                "absolute top-1 left-1 size-6 rounded-full bg-white shadow-sm",
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
