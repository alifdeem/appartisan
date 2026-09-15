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
 */
export function DiscardDraft({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState(discardDraftAction, null);
  const [confirming, setConfirming] = React.useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        className="text-ink-500 hover:text-danger-700"
      >
        <Trash2 />
        Discard
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="jobId" value={jobId} />

      <span className="text-sm text-ink-600">Discard this draft?</span>

      <Button type="submit" variant="danger" size="sm" loading={pending}>
        Discard
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        Keep
      </Button>

      {state?.error && (
        <span role="alert" className="text-sm text-danger-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
