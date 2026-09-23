"use client";

import { useActionState } from "react";
import { ArrowUpRight } from "lucide-react";

import { postJobAction } from "@/app/(app)/client/actions";
import { StickyAction } from "@/components/mobile/sticky-action";
import { Button } from "@/components/ui/button";

/**
 * The irreversible one.
 *
 * `post_job` validates completeness in the database, so an error here is a real
 * sentence written by Postgres ("Pin the job location before posting.") rather
 * than a generic failure. Surfacing it verbatim is deliberate — the client can
 * act on it, and the alternative is a dead end on the last screen of the flow.
 *
 * The error renders inside the pinned bar rather than up in the page, because
 * that is where the eye already is when the button has just failed — an error
 * message 600px above the control that produced it is an error message nobody
 * reads.
 */
export function PostButton({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState(postJobAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />

      <StickyAction>
        {state?.error && (
          <p
            role="alert"
            className="animate-fade-in mb-2.5 rounded-[1rem] border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-note text-danger-700"
          >
            {state.error}
          </p>
        )}

        <Button type="submit" variant="navy" size="lg" shape="pill" block loading={pending}>
          Post this job
          <ArrowUpRight />
        </Button>

        <p className="mt-2.5 text-center text-2xs text-copy-muted">
          Posting costs nothing. You approve a price before anyone travels.
        </p>
      </StickyAction>
    </form>
  );
}
