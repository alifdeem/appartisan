"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, PauseCircle, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { reviewProviderAction, type AdminActionState } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VerificationStatus } from "@/lib/supabase/types";

type Decision = "approved" | "rejected" | "suspended";

/**
 * The decision.
 *
 * **There is no confirmation dialog, and the reason is the notes field.**
 * Rejecting or suspending an artisan is a consequential act, so it should be
 * hard to do by accident — but a modal is the wrong instrument, because staff
 * doing this forty times a day learn to dismiss modals without reading them.
 * Instead the submit button stays disabled until a reason has been typed. The
 * friction is real work that produces a real artefact, rather than a speed bump
 * that produces a habit.
 *
 * That the reason is *required* is enforced in `review_provider_application()`,
 * not here. This only decides when to light the button.
 *
 * **Approve is one option among three, not the default.** The options are
 * rendered as a choice the admin makes rather than as a primary action with two
 * escape hatches, because an admin who opens this screen has not yet decided —
 * they are about to read a Ghana Card. Pre-selecting "approve" would be putting
 * a thumb on that scale.
 *
 * The action is called from the submit handler rather than through
 * `useActionState`, because success here means *clearing the form* — and a
 * result that has to be reconciled back into local state is exactly the effect
 * this codebase keeps refusing to write. In a handler it is a straight line:
 * send, then clear.
 */
export function ReviewDecision({
  providerId,
  currentStatus,
}: {
  providerId: string;
  currentStatus: VerificationStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [decision, setDecision] = React.useState<Decision | null>(null);
  const [notes, setNotes] = React.useState("");
  const [result, setResult] = React.useState<AdminActionState | null>(null);
  const notesRef = React.useRef<HTMLTextAreaElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const next = await reviewProviderAction(null, formData);
      setResult(next);

      if (next.ok) {
        toast.success("Decision recorded.");
        setDecision(null);
        setNotes("");
        router.refresh();
      } else if (next.fieldErrors?.callNotes) {
        notesRef.current?.focus();
      }
    });
  }

  // Approving somebody who is already approved is the one combination the RPC
  // rejects outright, so it is not offered.
  const allOptions: { value: Decision; label: string; icon: typeof BadgeCheck; hint: string }[] = [
    {
      value: "approved",
      label: currentStatus === "suspended" ? "Reinstate" : "Approve",
      icon: BadgeCheck,
      hint: "They can go online and receive jobs.",
    },
    {
      value: "rejected",
      label: "Reject",
      icon: ShieldX,
      hint: "They can fix it and apply again.",
    },
    {
      value: "suspended",
      label: "Suspend",
      icon: PauseCircle,
      hint: "Removed from matching until reinstated.",
    },
  ];

  const options = allOptions.filter((option) => option.value !== currentStatus);

  const notesRequired = decision === "rejected" || decision === "suspended";
  const canSubmit = decision !== null && (!notesRequired || notes.trim().length > 0);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="providerId" value={providerId} />
      <input type="hidden" name="decision" value={decision ?? ""} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink-800">Decision</legend>

        <div className="grid gap-2 sm:grid-cols-3">
          {options.map((option) => {
            const on = decision === option.value;
            const destructive = option.value !== "approved";

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setDecision(on ? null : option.value)}
                aria-pressed={on}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-field border p-3 text-left",
                  "transition-[border-color,background-color,transform] duration-[var(--duration-fast)] ease-out-strong",
                  "active:scale-[0.98]",
                  on && !destructive && "border-success-600 bg-success-50 ring-1 ring-success-600",
                  on && destructive && "border-danger-600 bg-danger-50 ring-1 ring-danger-600",
                  !on && "border-ink-300 bg-ink-0 hover:border-ink-400",
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium",
                    on && !destructive && "text-success-700",
                    on && destructive && "text-danger-700",
                    !on && "text-ink-800",
                  )}
                >
                  <option.icon className="size-4" aria-hidden />
                  {option.label}
                </span>
                <span className="text-xs leading-snug text-ink-500">{option.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="callNotes" className="block text-sm font-medium text-ink-800">
          Call notes
          {notesRequired ? (
            <span className="ml-0.5 text-danger-600" aria-hidden>
              *
            </span>
          ) : (
            <span className="ml-1.5 text-xs font-normal text-ink-400">optional</span>
          )}
        </label>

        <Textarea
          ref={notesRef}
          id="callNotes"
          name="callNotes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={
            notesRequired
              ? "What went wrong, in words the artisan can act on. They will read this."
              : "What you confirmed on the call — who answered, what they said about their work, anything worth remembering."
          }
          aria-invalid={Boolean(result?.fieldErrors?.callNotes)}
          aria-describedby="callNotes-note"
        />

        <p
          id="callNotes-note"
          className={cn(
            "text-sm",
            result?.fieldErrors?.callNotes ? "text-danger-600" : "text-ink-500",
          )}
          role={result?.fieldErrors?.callNotes ? "alert" : undefined}
        >
          {result?.fieldErrors?.callNotes ??
            (notesRequired
              ? "Shown to the artisan. This is the only thing telling them what to fix."
              : "The offline vetting call lives here. Kept for the audit trail.")}
        </p>
      </div>

      {result?.error && (
        <p role="alert" className="animate-fade-in text-sm text-danger-600">
          {result.error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        variant={decision === "approved" ? "primary" : decision ? "danger" : "secondary"}
        loading={pending}
        disabled={!canSubmit}
      >
        {decision === null
          ? "Choose a decision"
          : decision === "approved"
            ? currentStatus === "suspended"
              ? "Reinstate this artisan"
              : "Approve this artisan"
            : decision === "rejected"
              ? "Reject this application"
              : "Suspend this artisan"}
      </Button>
    </form>
  );
}
