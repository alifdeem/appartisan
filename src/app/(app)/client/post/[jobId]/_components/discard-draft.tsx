"use client";

import * as React from "react";
import { useActionState } from "react";
import { Trash2 } from "lucide-react";

import { discardDraftAction } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";

/**
 * Throwing a draft away.
 *
 * Confirms inline rather than through `window.confirm`, which on Android is a
 * system dialog that looks nothing like the app and is dismissed by the same
 * back gesture people use for navigation — the two easiest ways to delete
 * something by accident.
 *
 * The action also clears the bucket. A draft can be carrying six photographs of
 * the inside of somebody's home; "discard" has to mean the files are gone, not
 * just the row that pointed at them.
 *
 * **The confirmation is anchored, not inline.** It now lives in the flow's
 * header bar beside a back button and a title. Expanding a sentence and two
 * buttons into that row overflows it at 360px — so the trigger stays a fixed
 * 44px icon and the confirmation opens as a small card beneath it, which cannot
 * push anything around whatever it contains.
 */
export function DiscardDraft({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState(discardDraftAction, null);
  const [confirming, setConfirming] = React.useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setConfirming((open) => !open)}
        aria-expanded={confirming}
        aria-label="Discard this draft"
        className="-mr-2 grid size-11 place-items-center rounded-full text-copy-muted transition-colors duration-[var(--duration-instant)] hover:bg-white hover:text-danger-700 active:bg-azure-50"
      >
        <Trash2 className="size-5" aria-hidden />
      </button>

      {confirming && (
        <div className="animate-fade-in absolute top-full right-0 z-20 mt-1 w-56 rounded-[1.25rem] border border-hairline bg-white p-4 shadow-[var(--shadow-sheet)]">
          <p className="text-note leading-relaxed text-navy-900">
            Discard this draft? Any photos you added go with it.
          </p>

          {state?.error && (
            <p role="alert" className="mt-2 text-note text-danger-600">
              {state.error}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <form action={formAction} className="flex-1">
              <input type="hidden" name="jobId" value={jobId} />
              <Button type="submit" variant="danger" size="sm" shape="pill" block loading={pending}>
                Discard
              </Button>
            </form>

            <Button
              type="button"
              variant="navyOutline"
              size="sm"
              shape="pill"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="flex-1"
            >
              Keep
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
