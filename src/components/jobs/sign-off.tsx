"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { toast } from "sonner";

import { signOffJobAction } from "@/app/(app)/client/actions";
import type { JobActionState } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

/**
 * Signing the work off.
 *
 * A typed name rather than a drawn signature. A canvas scribble on a phone is
 * fiddlier to produce, no more binding in Ghana than a typed name, and
 * illegible six weeks later when it is the thing a dispute turns on. What
 * matters is that a specific person confirmed a specific job at a specific
 * time, and `signoffs` records all three.
 *
 * The balance is deliberately NOT collected here. PLAN.md §4: mobile money
 * cannot be charged without the customer approving a fresh prompt, so the
 * sequence has to be sign first, then pay while the artisan is still on site.
 * Bundling them would imply the money moves on signing, which it cannot.
 */
export function SignOff({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<JobActionState | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const next = await signOffJobAction(null, formData);
      setState(next);

      if (next.ok) {
        toast.success("Signed off. The balance is due now.");
        router.refresh();
      } else if (next.error) {
        toast.error(next.error);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-card border border-ink-200 bg-ink-0 p-4 shadow-sm"
    >
      <input type="hidden" name="jobId" value={jobId} />

      <div>
        <h2 className="text-sm font-semibold text-ink-900">Happy with the work?</h2>
        <p className="mt-0.5 text-sm text-ink-600">
          Check it over before you sign. Once you sign, the balance is due and the artisan is paid.
        </p>
      </div>

      <Field
        label="Type your name to sign"
        htmlFor="signature"
        required
        error={state?.fieldErrors?.signature}
      >
        <Input id="signature" name="signature" autoComplete="name" maxLength={80} required />
      </Field>

      <Field label="Anything to note" htmlFor="signoff-notes" error={state?.fieldErrors?.notes}>
        <Textarea
          id="signoff-notes"
          name="notes"
          rows={2}
          maxLength={1000}
          placeholder="Optional — anything you want on the record."
        />
      </Field>

      <Button type="submit" disabled={pending} block>
        <PenLine />
        {pending ? "Signing…" : "Sign off the work"}
      </Button>
    </form>
  );
}
