"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { toast } from "sonner";

import { cancelJobAction } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";
import { panelControlClasses } from "@/components/mobile/panel-field";

/**
 * Cancelling a posted job.
 *
 * Only rendered for statuses that are free to cancel (PLAN.md §7) — before a
 * deposit there is nothing to refund and nobody is travelling. The database
 * re-checks that in `cancel_job`; the UI only decides whether to offer it.
 *
 * The reason field is optional and goes into `job_events`. It costs the client
 * two seconds and it is the only signal the client's ops team will ever get
 * about *why* jobs are being abandoned before matching — which, at launch, is
 * the number they will most want.
 */
export function CancelJob({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(cancelJobAction, null);
  const [open, setOpen] = React.useState(false);

  /**
   * Announcing the result and refetching are genuine side effects, so an effect
   * is the right home for them — unlike deriving state, which this component
   * deliberately does not do: on success the job stops being cancellable, the
   * parent stops rendering this component, and there is no panel left to close.
   * Keyed on `state` rather than `state.ok` so a second failure still toasts.
   */
  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Job cancelled.");
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        shape="pill"
        onClick={() => setOpen(true)}
        className="text-copy-muted hover:bg-danger-50 hover:text-danger-700"
      >
        <XCircle />
        Cancel this job
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-[1.25rem] border border-hairline bg-canvas p-3.5">
      <input type="hidden" name="jobId" value={jobId} />

      <div className="space-y-1">
        <p className="font-space text-note font-bold text-navy-900">Cancel this job?</p>
        <p className="text-note text-copy-muted">
          Nothing has been charged, so there is nothing to refund. You can post it again any time.
        </p>
      </div>

      <input
        name="reason"
        maxLength={300}
        placeholder="Why? (optional — helps us improve)"
        aria-label="Reason for cancelling"
        className={panelControlClasses(false, "py-2.5 text-ui")}
      />

      <div className="flex gap-2">
        <Button type="submit" variant="danger" size="sm" shape="pill" loading={pending}>
          Cancel job
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          shape="pill"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Keep it
        </Button>
      </div>
    </form>
  );
}
