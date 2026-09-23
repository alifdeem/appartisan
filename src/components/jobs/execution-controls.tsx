"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Car, CheckCircle2, Hammer, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { callAction } from "@/lib/action-call";

import { advanceJobAction, type ProviderActionState } from "@/app/(app)/provider/actions";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/supabase/types";

/**
 * The artisan's controls on site.
 *
 * One button at a time, never a menu of states. The artisan is standing in
 * somebody's kitchen holding a phone in one hand — the only useful question is
 * "what just happened?", and the answer is always the next single thing.
 *
 * The order is enforced in `advance_job_execution` (0015-0017) against a table
 * of legal transitions, so this component decides what to *show*, never what is
 * *allowed*. An artisan who marks "arrived" without ever setting out leaves a
 * client watching a map that never moved, which is why the database refuses it
 * rather than trusting the button that was rendered.
 *
 * **It now lives inside the status hero rather than in a card below it.** The
 * hero already says where the job has got to; this is the one control that
 * moves it on. Two separate surfaces made the reader look twice to answer one
 * question, and put the most important button on the artisan's whole screen
 * below a heading that said "What's happening now" — a label for a state, over
 * a control for changing it.
 *
 * On the navy ground the button is white. It is the only white-filled thing in
 * the hero, which is what makes it findable at arm's length in daylight.
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
    label: "I’m setting out",
    hint: "The client sees that you are on the way.",
    icon: Car,
  },
  en_route: {
    to: "arrived",
    label: "I’ve arrived",
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
    if (pending || blocked) return;

    startTransition(async () => {
      const next = await callAction(() => advanceJobAction(jobId, step.to));
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
    <div className="space-y-3">
      <p className="text-note leading-relaxed text-white/85">{step.hint}</p>

      {blocked && (
        <p className="flex items-start gap-2 rounded-[1rem] bg-white/15 px-3.5 py-2.5 text-note leading-relaxed text-white">
          <Camera className="mt-0.5 size-4 shrink-0" aria-hidden />
          Add at least one photo of the finished work before you mark it done.
        </p>
      )}

      <button
        type="button"
        onClick={advance}
        disabled={pending || blocked}
        aria-busy={pending || undefined}
        className={cn(
          "flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full px-6",
          "bg-white text-ui font-bold text-azure-700",
          "transition-[transform,opacity,background-color] duration-[var(--duration-instant)] ease-out-strong",
          "hover:bg-azure-50 active:scale-[0.98]",
          "disabled:pointer-events-none disabled:opacity-45",
        )}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Icon className="size-5" aria-hidden />
        )}
        {pending ? "Saving…" : step.label}
      </button>
    </div>
  );
}
