"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { resolveDisputeAction, type AdminActionState } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";

/**
 * The decision on one dispute.
 *
 * Three outcomes, matching the enum: investigating (we have picked it up),
 * resolved (something was done), rejected (nothing was owed). The note is
 * required for the two closing outcomes and the database enforces that — the
 * `disabled` below is a courtesy, not the rule.
 */
export function DisputeDecision({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<AdminActionState | null>(null);
  const [decision, setDecision] = React.useState<"investigating" | "resolved" | "rejected">(
    "investigating",
  );
  const [note, setNote] = React.useState("");

  /** Success clears the note, so this is a handler rather than an effect. */
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const next = await resolveDisputeAction(null, formData);
      setState(next);

      if (next.ok) {
        toast.success("Dispute updated.");
        setNote("");
        router.refresh();
      } else if (next.error) {
        toast.error(next.error);
      }
    });
  }

  const needsNote = decision !== "investigating";

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-ink-200 pt-3">
      <input type="hidden" name="disputeId" value={disputeId} />
      <input type="hidden" name="status" value={decision} />

      <div className="flex flex-wrap gap-2">
        {(["investigating", "resolved", "rejected"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={decision === option}
            onClick={() => setDecision(option)}
            className={
              decision === option
                ? "min-h-9 rounded-full border border-ink-900 bg-ink-900 px-3 text-sm capitalize text-ink-0"
                : "min-h-9 rounded-full border border-ink-200 bg-ink-0 px-3 text-sm capitalize text-ink-700 transition-colors hover:border-ink-300"
            }
          >
            {option}
          </button>
        ))}
      </div>

      <textarea
        name="resolution"
        rows={2}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={
          needsNote
            ? "What was decided, and why? Required."
            : "Any note for the record (optional)"
        }
        maxLength={2000}
        className="w-full rounded-field border border-ink-200 bg-ink-25 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
      />

      {state?.fieldErrors?.resolution && (
        <p className="text-sm text-danger-700">{state.fieldErrors.resolution}</p>
      )}

      <Button type="submit" size="sm" disabled={pending || (needsNote && note.trim().length === 0)}>
        {pending ? "Saving…" : "Record decision"}
      </Button>
    </form>
  );
}
