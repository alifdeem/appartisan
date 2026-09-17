"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { rateJobAction } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";
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
 */

const TAGS = ["On time", "Tidy", "Fair price", "Explained the work", "Polite", "Would book again"];

function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const [hovered, setHovered] = React.useState(0);
  const shown = hovered || value;

  return (
    <div
      className="flex items-center gap-1"
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
          className="grid size-11 place-items-center rounded-field transition-colors hover:bg-ink-100"
        >
          <Star
            className={cn(
              "size-7 transition-colors",
              n <= shown ? "fill-accent-400 text-accent-500" : "text-ink-300",
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
      const next = await rateJobAction(null, formData);
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
      <section className="rounded-card border border-ink-200 bg-ink-0 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-0.5" aria-label={`You rated ${existing.stars} of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={cn(
                  "size-4",
                  n <= existing.stars ? "fill-accent-400 text-accent-500" : "text-ink-300",
                )}
              />
            ))}
          </div>
          <p className="text-sm text-ink-600">You rated this job.</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-auto text-sm font-medium text-ink-500 underline-offset-4 transition-colors hover:text-ink-900 hover:underline"
          >
            Change
          </button>
        </div>
        {existing.comment && <p className="mt-2 text-sm text-ink-700 italic">“{existing.comment}”</p>}
      </section>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-card border border-ink-200 bg-ink-0 p-4 shadow-sm"
    >
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="stars" value={stars} />
      <input type="hidden" name="tags" value={tags.join(",")} />

      <div>
        <h2 className="text-sm font-semibold text-ink-900">How did it go?</h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Your rating decides who gets offered work next.
        </p>
      </div>

      <Stars value={stars} onChange={setStars} />
      {state?.fieldErrors?.stars && (
        <p className="text-sm text-danger-700">{state.fieldErrors.stars}</p>
      )}

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
                "min-h-9 rounded-full border px-3 text-sm transition-colors",
                active
                  ? "border-ink-900 bg-ink-900 text-ink-0"
                  : "border-ink-200 bg-ink-0 text-ink-700 hover:border-ink-300",
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <textarea
        name="comment"
        rows={3}
        defaultValue={existing?.comment ?? ""}
        placeholder="Anything else? (optional)"
        maxLength={1000}
        className="w-full rounded-field border border-ink-200 bg-ink-25 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || stars === 0}>
          {pending ? "Sending…" : existing ? "Update rating" : "Submit rating"}
        </Button>
        {existing && (
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
