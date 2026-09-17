"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { raiseDisputeAction } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";
import type { JobActionState } from "@/app/(app)/client/actions";
import type { DisputeRow } from "@/lib/supabase/types";

/**
 * Raising a dispute.
 *
 * Kept behind a disclosure rather than sitting open on the page. A visible
 * "Report a problem" form on every finished job invites a complaint from
 * somebody who does not have one, and the artisan carries the cost of that.
 * One tap away is the right distance.
 *
 * The reasons are a fixed list because free text alone gives an admin nothing
 * to sort a queue by, and because "the work is not finished" and "I was
 * overcharged" go to different places once this has any volume.
 */

const REASONS = [
  "The work is not finished",
  "The work is faulty",
  "The artisan damaged something",
  "I was charged the wrong amount",
  "The artisan did not turn up",
  "Something else",
];

const OPEN_STATUSES: DisputeRow["status"][] = ["open", "investigating"];

export function RaiseDispute({ jobId, existing }: { jobId: string; existing: DisputeRow | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<JobActionState | null>(null);
  const [open, setOpen] = React.useState(false);

  /** Success closes the panel, so this runs in a handler rather than an effect. */
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const next = await raiseDisputeAction(null, formData);
      setState(next);

      if (next.ok) {
        toast.success("Reported. Someone will be in touch.");
        setOpen(false);
        router.refresh();
      } else if (next.error) {
        toast.error(next.error);
      }
    });
  }

  if (existing) {
    const live = OPEN_STATUSES.includes(existing.status);
    return (
      <section className="rounded-card border border-ink-200 bg-ink-0 p-4 shadow-sm">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-ink-900">
              {live ? "You reported a problem" : "Your report was closed"}
            </p>
            <p className="text-sm text-ink-600">{existing.reason}</p>
            {existing.resolution && (
              <p className="text-sm text-ink-700">
                <span className="font-medium">Outcome:</span> {existing.resolution}
              </p>
            )}
            {live && (
              <p className="text-sm text-ink-500">
                Someone from ArtisanGH will call you about this.
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded-card border border-ink-200 bg-ink-0 px-4 text-sm text-ink-600 shadow-sm transition-colors hover:border-ink-300 hover:text-ink-900"
      >
        <AlertTriangle className="size-4 text-ink-400" aria-hidden />
        Report a problem with this job
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-card border border-ink-200 bg-ink-0 p-4 shadow-sm"
    >
      <input type="hidden" name="jobId" value={jobId} />

      <div>
        <h2 className="text-sm font-semibold text-ink-900">What went wrong?</h2>
        <p className="mt-0.5 text-sm text-ink-500">
          We hold the artisan&rsquo;s payout while this is looked at.
        </p>
      </div>

      <div className="space-y-2">
        {REASONS.map((reason, index) => (
          <label key={reason} className="flex min-h-11 items-center gap-2.5 text-sm text-ink-800">
            <input
              type="radio"
              name="reason"
              value={reason}
              defaultChecked={index === 0}
              className="size-4 accent-ink-900"
            />
            {reason}
          </label>
        ))}
      </div>
      {state?.fieldErrors?.reason && (
        <p className="text-sm text-danger-700">{state.fieldErrors.reason}</p>
      )}

      <textarea
        name="detail"
        rows={3}
        placeholder="What happened? (optional, but it helps)"
        maxLength={2000}
        className="w-full rounded-field border border-ink-200 bg-ink-25 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
      />

      <div className="flex items-center gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Sending…" : "Report it"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
