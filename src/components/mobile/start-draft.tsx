"use client";

import * as React from "react";
import { useActionState } from "react";

import { startDraftAction } from "@/app/(app)/client/actions";
import { cn } from "@/lib/utils";

/**
 * Tapping a trade anywhere in the app and landing on the form with that trade
 * already chosen.
 *
 * **Why these tiles are buttons and not links.** Reaching the describe step
 * needs a draft `jobs` row to exist — that is the `[jobId]` in the URL — and
 * creating one is a write. A link is a GET, and Next prefetches GETs on hover
 * and on viewport entry, so a linked tile would create draft jobs for every
 * trade a thumb happened to scroll past. So the tile posts to
 * `startDraftAction`, exactly as the picker grid has always done, and the
 * action redirects to the draft it creates.
 *
 * That action already reuses an existing unfinished draft for the same trade
 * rather than making a second one, so tapping Plumbing, backing out and tapping
 * Plumbing again returns to the same draft instead of littering.
 *
 * **What this costs.** No prefetch and no open-in-new-tab, and a server
 * round-trip before the screen changes. The spinner lands on the tile that was
 * actually tapped, which is what makes the wait legible — one `pending` flag
 * across a grid of 26 would either spin all of them or none.
 *
 * Wrap any group of trade tiles in `<StartDraftForm>`; each tile reads
 * `useStartDraft()` for the pending state and reports which id it submitted.
 */

interface StartDraft {
  /** True while any tile in this group is submitting. */
  pending: boolean;
  /** The id of the tile that was tapped, so only it shows a spinner. */
  chosenId: string | null;
  choose: (id: string) => void;
}

const StartDraftContext = React.createContext<StartDraft | null>(null);

export function useStartDraft(): StartDraft {
  const context = React.useContext(StartDraftContext);
  if (!context) {
    throw new Error("A trade tile must be rendered inside <StartDraftForm>.");
  }
  return context;
}

export function StartDraftForm({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(startDraftAction, null);
  const [chosenId, setChosenId] = React.useState<string | null>(null);

  const value = React.useMemo<StartDraft>(
    () => ({ pending, chosenId, choose: setChosenId }),
    [pending, chosenId],
  );

  return (
    <form action={formAction} className={className}>
      {state?.error && (
        <p
          role="alert"
          className="animate-fade-in mb-3 rounded-[0.875rem] border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-note text-danger-700"
        >
          {state.error}
        </p>
      )}

      <StartDraftContext.Provider value={value}>{children}</StartDraftContext.Provider>
    </form>
  );
}

/**
 * The submit button every trade tile is built on — one place that knows the
 * field name the action reads, so a restyled tile cannot quietly stop working.
 */
export function TradeTile({
  categoryId,
  className,
  children,
}: {
  categoryId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { pending, chosenId, choose } = useStartDraft();
  const busy = pending && chosenId === categoryId;

  return (
    <button
      type="submit"
      name="categoryId"
      value={categoryId}
      onClick={() => choose(categoryId)}
      disabled={pending}
      // The tapped tile keeps full opacity while its siblings dim: the dimming
      // says "the app heard you", and dimming the one under the finger too
      // would say "that tap did nothing".
      className={cn("text-left disabled:opacity-55", busy && "disabled:opacity-100", className)}
      aria-busy={busy || undefined}
    >
      {children}
    </button>
  );
}
