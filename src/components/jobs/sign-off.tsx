"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { toast } from "sonner";

import { callAction } from "@/lib/action-call";

import { signOffJobAction } from "@/app/(app)/client/actions";
import type { JobActionState } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";
import { PanelField, PanelInput, panelControlClasses } from "@/components/mobile/panel-field";

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
 *
 * The azure ground is deliberate and it is the only form in the app that gets
 * it. This is the moment a client accepts that a job is finished and a payment
 * becomes due, and it should not look like the notes field it sits next to.
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
      const next = await callAction(() => signOffJobAction(null, formData));
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
      className="animate-fade-up space-y-4 rounded-[1.5rem] border border-azure-200 bg-linear-to-b from-azure-50 to-white p-5 shadow-[var(--shadow-float)]"
    >
      <input type="hidden" name="jobId" value={jobId} />

      <div>
        <h2 className="font-space text-lede font-bold text-navy-900">Happy with the work?</h2>
        <p className="mt-1 text-note leading-relaxed text-copy-muted">
          Check it over before you sign. Once you sign, the balance is due and the artisan is paid.
        </p>
      </div>

      <PanelField
        label="Type your name to sign"
        htmlFor="signature"
        error={state?.fieldErrors?.signature}
      >
        <PanelInput
          id="signature"
          name="signature"
          autoComplete="name"
          maxLength={80}
          required
          invalid={Boolean(state?.fieldErrors?.signature)}
        />
      </PanelField>

      <PanelField
        label="Anything to note"
        htmlFor="signoff-notes"
        optional
        error={state?.fieldErrors?.notes}
      >
        <textarea
          id="signoff-notes"
          name="notes"
          rows={2}
          maxLength={1000}
          placeholder="Anything you want on the record."
          className={panelControlClasses(Boolean(state?.fieldErrors?.notes), "resize-none")}
        />
      </PanelField>

      <Button type="submit" variant="navy" size="lg" shape="pill" block loading={pending}>
        <PenLine />
        {pending ? "Signing…" : "Sign off the work"}
      </Button>
    </form>
  );
}
