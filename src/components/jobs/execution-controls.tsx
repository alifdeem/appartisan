"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Car, CheckCircle2, Hammer, MapPin } from "lucide-react";
import { toast } from "sonner";

import { advanceJobAction, type ProviderActionState } from "@/app/(app)/provider/actions";
import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/lib/supabase/types";

/**
 * The artisan's controls on site.
 *
 * One button at a time, never a menu of states. The artisan is standing in
 * somebody's kitchen holding a phone in one hand — the only useful question is
 * "what just happened?", and the answer is always the next single thing.
 *
 * The order is enforced in `advance_job_execution` (0015-0017) against a table
 * of legal transitions, so this component decides what to *show*, never what
 * is *allowed*. An artisan who marks "arrived" without ever setting out leaves
 * a client watching a map that never moved, which is why the database refuses
 * it rather than trusting the button that was rendered.
 */

const STEPS: Record<
  string,
  {
    to: "en_route" | "arrived" | "in_progress" | "awaiting_signoff";
    label: string;
    hint: string;
    icon: typeof Car;
  }
> = {
  deposit_paid: {
    to: "en_route",
    label: "I'm setting out",
    hint: "The client sees that you are on the way.",
    icon: Car,
  },
  en_route: {
    to: "arrived",
    label: "I've arrived",
    hint: "Tap this when you are at the address.",
    icon: MapPin,
  },
  arrived: {
    to: "in_progress",
    label: "Starting work",
    hint: "From here the deposit is no longer refundable to the client.",
    icon: Hammer,
  },
  in_progress: {
    to: "awaiting_signoff",
    label: "Work is done",
    hint: "Add a photo of the finished work first — the client signs off on it.",
    icon: CheckCircle2,
  },
};

export function ExecutionControls({
  jobId,
  status,
  completionPhotoCount,
}: {
  jobId: string;
  status: JobStatus;
  completionPhotoCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [, setState] = React.useState<ProviderActionState | null>(null);

  const step = STEPS[status];
  if (!step) return null;

  // The database refuses this too (0015). Saying so before the tap is the
  // difference between guidance and an error message.
  const blocked = step.to === "awaiting_signoff" && completionPhotoCount === 0;

  function advance() {
    if (pending) return;

    startTransition(async () => {
      const next = await advanceJobAction(jobId, step.to);
      setState(next);

      if (next.ok) {
        toast.success(
          step.to === "awaiting_signoff" ? "Sent to the client to sign off." : "Updated.",
        );
        router.refresh();
      } else if (next.error) {
        toast.error(next.error);
      }
    });
  }

  const Icon = step.icon;

  return (
    <section className="space-y-3 rounded-card border border-ink-200 bg-ink-0 p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-ink-900">What&rsquo;s happening now</h2>
        <p className="mt-0.5 text-sm text-ink-600">{step.hint}</p>
      </div>

      {blocked && (
        <p className="flex items-start gap-2 rounded-field bg-warning-50 px-3 py-2 text-sm text-warning-800">
          <Camera className="mt-0.5 size-4 shrink-0" aria-hidden />
          Add at least one photo of the finished work before you mark it done.
        </p>
      )}

      <Button type="button" onClick={advance} disabled={pending || blocked} block size="lg">
        <Icon />
        {pending ? "Saving…" : step.label}
      </Button>
    </section>
  );
}
