"use client";

import * as React from "react";
import { Send } from "lucide-react";

import { submitApplicationAction } from "@/app/(app)/provider/actions";
import { Button } from "@/components/ui/button";

/**
 * The button that puts an artisan in the queue.
 *
 * Disabled while anything is missing rather than hidden, and the reasons sit
 * directly above it — so "why can I not press this" is answered on the same
 * screen, without a trip through an error state.
 *
 * No confirmation dialog. Submitting is not destructive: the worst case is a
 * rejection with notes explaining what to fix, and the artisan can resubmit.
 * Guarding a reversible action with a modal trains people to dismiss modals.
 *
 * Called from the click handler rather than through `useActionState`, because
 * the action takes no form fields and the success path is a redirect — a
 * `<form action>` would buy nothing and leave the failure to be reconciled in
 * an effect.
 */
export function SubmitApplication({ ready }: { ready: boolean }) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      // Only ever returns on failure — success redirects out of this tree.
      const result = await submitApplicationAction();
      if (!result.ok) setError(result.error ?? "Could not send your application. Try again.");
    });
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="lg"
        block
        loading={pending}
        disabled={!ready}
        onClick={submit}
      >
        <Send />
        Send for review
      </Button>

      {error && (
        <p role="alert" className="animate-fade-in text-sm text-danger-600">
          {error}
        </p>
      )}

      <p className="text-center text-sm text-ink-500">
        Reviews usually take a day or two. We will call you on the number you signed up with.
      </p>
    </div>
  );
}
