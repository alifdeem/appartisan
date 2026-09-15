"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";

import { postJobAction } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";

/**
 * The irreversible one.
 *
 * `post_job` validates completeness in the database, so an error here is a real
 * sentence written by Postgres ("Pin the job location before posting.") rather
 * than a generic failure. Surfacing it verbatim is deliberate — the client can
 * act on it, and the alternative is a dead end on the last screen of the flow.
 */
export function PostButton({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState(postJobAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />

      {state?.error && (
        <p
          role="alert"
          className="animate-fade-in rounded-card border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" block loading={pending}>
        <Send />
        Post this job
      </Button>

      <p className="text-center text-xs text-ink-500">
        Posting costs nothing. You approve a price before anyone travels.
      </p>
    </form>
  );
}
