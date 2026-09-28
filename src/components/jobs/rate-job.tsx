"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { callAction } from "@/lib/action-call";

import { rateJobAction } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/mobile/field-label";
import { panelControlClasses } from "@/components/mobile/panel-field";
import type { JobActionState } from "@/app/(app)/client/actions";
import type { RatingRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Rating the artisan.
 *
 * The tags are the point. A free-text box asks somebody to compose a review,
 * which most people will not do on a phone after a plumber has left; tapping
 * "On time" takes a second and still produces something another client can use.
 * Comment stays optional underneath.
 *
 * Shown already-rated rather than hidden once submitted, because a client who
 * rated three stars in a bad moment should be able to see that and change it —
 * `rate_job` upserts, so revising is a first-class path rather than a support
 * ticket.
 *
 * **The stars keep amber.** It is the one place in the redesign where the old
 * money colour earns a second job, and it earns it because a five-pointed star
 * is gold everywhere on earth — a navy star reads as a bug, not as a brand.
 */

const TAGS = ["On time", "Tidy", "Fair price", "Explained the work", "Polite", "Would book again"];

function Stars({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const [hovered, setHovered] = React.useState(0);
  const shown = hovered || value;

  return (
    <div
      className="flex items-center gap-0.5"
      role="radiogroup"
      aria-label="Stars"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          className={cn(
            "grid size-12 place-items-center rounded-full",
            "transition-[background-color,transform] duration-[var(--duration-instant)] ease-out-strong",
            "hover:bg-azure-50 active:scale-90",
          )}
        >
          <Star
            className={cn(
              "size-8 transition-colors duration-[var(--duration-fast)]",
              n <= shown ? "fill-warning-500 text-warning-500" : "text-hairline",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function RateJob({ jobId, existing }: { jobId: string; existing: RatingRow | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<JobActionState | null>(null);
  const [stars, setStars] = React.useState(existing?.stars ?? 0);
  const [tags, setTags] = React.useState<string[]>(existing?.tags ?? []);
  const [open, setOpen] = React.useState(!existing);

  /**
   * A submit handler rather than `useActionState`, because success here means
   * closing the panel — and reconciling an action result back into local state
   * is the effect this codebase keeps refusing to write. In a handler it is a
   * straight line: send, then close.
   */
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const next = await callAction(() => rateJobAction(null, formData));
      setState(next);

      if (next.ok) {
        toast.success(existing ? "Rating updated." : "Thanks — your rating helps the next client.");
        setOpen(false);
        router.refresh();
      } else if (next.error) {
        toast.error(next.error);
      }
    });
  }

  if (existing && !open) {
    return (
      <section className="rounded-[1.25rem] border border-hairline bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-0.5"
            aria-label={`You rated ${existing.stars} of 5`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={cn(
                  "size-4",
                  n <= existing.stars ? "fill-warning-500 text-warning-500" : "text-hairline",
                )}
                aria-hidden
              />
            ))}
          </div>
          <p className="text-note text-copy-muted">You rated this job.</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="tap ml-auto text-note font-semibold text-azure-600 underline-offset-4 hover:underline"
          >
            Change
          </button>
        </div>
        {existing.comment && (
          <p className="mt-2.5 text-note leading-relaxed text-navy-900 italic">
            &ldquo;{existing.comment}&rdquo;
          </p>
        )}
      </section>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="animate-fade-up space-y-4 rounded-[1.5rem] border border-hairline bg-white p-5 shadow-[var(--shadow-float)]"
    >
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="stars" value={stars} />
      <input type="hidden" name="tags" value={tags.join(",")} />

      <div>
        <h2 className="font-space text-lede font-bold text-navy-900">How did it go?</h2>
        <p className="mt-1 text-note leading-relaxed text-copy-muted">
          Your rating decides who gets offered work next.
        </p>
      </div>

      {/* Centred and oversized. This is the one control on the screen, and a
          row of small stars tucked left reads as a setting rather than as the
          question being asked. */}
      <div className="flex justify-center">
        <Stars value={stars} onChange={setStars} />
      </div>
      {state?.fieldErrors?.stars && (
        <p role="alert" className="text-center text-note text-danger-600">
          {state.fieldErrors.stars}
        </p>
      )}

      <div className="space-y-2.5">
        <FieldLabel>What stood out</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setTags((current) =>
                    current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
                  )
                }
                className={cn(
                  "min-h-11 rounded-full px-4 text-note font-semibold",
                  "transition-[background-color,border-color,color,transform] duration-[var(--duration-fast)] ease-out-strong",
                  "active:scale-[0.97]",
                  active
                    ? "bg-linear-to-b from-navy-800 to-navy-900 text-white shadow-[var(--shadow-glow-navy)]"
                    : "border border-hairline bg-white text-navy-900 hover:border-azure-300 hover:bg-azure-50",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <textarea
        name="comment"
        rows={3}
        defaultValue={existing?.comment ?? ""}
        placeholder="Anything else? (optional)"
        maxLength={1000}
        aria-label="Your comment"
        className={panelControlClasses(false, "resize-none")}
      />

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="navy"
          size="lg"
          shape="pill"
          block={!existing}
          disabled={pending || stars === 0}
        >
          {pending ? "Sending…" : existing ? "Update rating" : "Submit rating"}
        </Button>
        {existing && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            shape="pill"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
