"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { callAction } from "@/lib/action-call";

import {
  ACCEPTED_PHOTO_TYPES,
  JOB_PHOTO_BUCKET,
  MAX_PHOTO_BYTES,
} from "@/lib/jobs/media";
import { createClient } from "@/lib/supabase/browser";

import { raiseDisputeAction } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";
import { panelControlClasses } from "@/components/mobile/panel-field";
import type { JobActionState } from "@/app/(app)/client/actions";
import type { DisputeRow } from "@/lib/supabase/types";

/**
 * Raising a dispute.
 *
 * Kept behind a disclosure rather than sitting open on the page. A visible
 * "Report a problem" form on every finished job invites a complaint from
 * somebody who does not have one, and the artisan carries the cost of that.
 * One tap away is the right distance.
 *
 * The reasons are a fixed list because free text alone gives an admin nothing
 * to sort a queue by, and because "the work is not finished" and "I was
 * overcharged" go to different places once this has any volume.
 */

const REASONS = [
  "The work is not finished",
  "The work is faulty",
  "The artisan damaged something",
  "I was charged the wrong amount",
  "The artisan did not turn up",
  "Something else",
];

const OPEN_STATUSES: DisputeRow["status"][] = ["open", "investigating"];

/** Enough to show a cracked faceplate from two angles and the room it is in. */
const MAX_EVIDENCE = 4;

export function RaiseDispute({ jobId, existing }: { jobId: string; existing: DisputeRow | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<JobActionState | null>(null);
  const [open, setOpen] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [evidence, setEvidence] = React.useState<string[]>([]);
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const [uploading, setUploading] = React.useState(false);

  // Release the object URLs on unmount. Each one pins the whole file in memory,
  // and six phone photos is not a small amount of it.
  React.useEffect(() => {
    return () => {
      for (const url of Object.values(previews)) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so retaking the same shot still fires
    if (!file) return;

    if (!ACCEPTED_PHOTO_TYPES.includes(file.type as (typeof ACCEPTED_PHOTO_TYPES)[number])) {
      toast.error("That is not a photo we can read. Use your camera.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("That photo is too large. The limit is 10MB.");
      return;
    }

    // Generated here, never taken from the file: a user's own filename can
    // contain anything, and the storage key is part of a policy expression.
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${jobId}/dispute-${crypto.randomUUID()}.${extension}`;

    setUploading(true);
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(JOB_PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);

    if (error) {
      console.error("[dispute] evidence upload failed", error);
      toast.error("Could not upload that photo. Check your connection.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setEvidence((current) => [...current, path]);
    setPreviews((current) => ({ ...current, [path]: previewUrl }));
  }

  async function discard(path: string) {
    const supabase = createClient();
    await supabase.storage.from(JOB_PHOTO_BUCKET).remove([path]);

    setEvidence((current) => current.filter((p) => p !== path));
    setPreviews((current) => {
      const next = { ...current };
      if (next[path]) URL.revokeObjectURL(next[path]);
      delete next[path];
      return next;
    });
  }

  /** Success closes the panel, so this runs in a handler rather than an effect. */
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const next = await callAction(() => raiseDisputeAction(null, formData));
      setState(next);

      if (next.ok) {
        toast.success("Reported. Someone will be in touch.");
        setOpen(false);
        router.refresh();
      } else if (next.error) {
        toast.error(next.error);
      }
    });
  }

  if (existing) {
    const live = OPEN_STATUSES.includes(existing.status);
    return (
      <section className="rounded-[1.25rem] border border-hairline bg-white p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="font-space text-note font-bold text-navy-900">
              {live ? "You reported a problem" : "Your report was closed"}
            </p>
            <p className="text-note text-copy-muted">{existing.reason}</p>
            {existing.resolution && (
              <p className="text-note text-copy-muted">
                <span className="font-medium">Outcome:</span> {existing.resolution}
              </p>
            )}
            {live && (
              <p className="text-note text-copy-muted">
                Someone from ArtisanGH will call you about this.
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded-[1.25rem] border border-hairline bg-white px-4 text-note text-copy-muted shadow-sm transition-colors hover:border-hairline hover:text-navy-900"
      >
        <AlertTriangle className="size-4 text-copy-muted" aria-hidden />
        Report a problem with this job
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-[1.25rem] border border-hairline bg-white p-4"
    >
      <input type="hidden" name="jobId" value={jobId} />

      <div>
        <h2 className="font-space text-lede font-bold text-navy-900">What went wrong?</h2>
        <p className="mt-0.5 text-note text-copy-muted">
          We hold the artisan&rsquo;s payout while this is looked at.
        </p>
      </div>

      <div className="space-y-2">
        {REASONS.map((reason, index) => (
          <label key={reason} className="flex min-h-11 items-center gap-2.5 text-note text-navy-900">
            <input
              type="radio"
              name="reason"
              value={reason}
              defaultChecked={index === 0}
              className="size-4 accent-navy-800"
            />
            {reason}
          </label>
        ))}
      </div>
      {state?.fieldErrors?.reason && (
        <p className="text-note text-danger-700">{state.fieldErrors.reason}</p>
      )}

      <textarea
        name="detail"
        rows={3}
        placeholder="What happened? (optional, but it helps)"
        maxLength={2000}
        aria-label="What happened"
        className={panelControlClasses(false, "resize-none py-2.5 text-ui")}
      />

      {/* Evidence. Same rule as job photos: the browser uploads straight to
          Storage and only the paths travel through the action, because an
          action body is capped at 1MB and a phone photo is not. The paths ride
          in a hidden field so the action stays a plain form post. */}
      <input type="hidden" name="evidencePaths" value={evidence.join(",")} />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {evidence.map((path) => (
            <span
              key={path}
              className="relative size-16 overflow-hidden rounded-[1rem] border border-hairline bg-canvas"
            >
              {previews[path] && (
                <Image src={previews[path]} alt="" fill sizes="64px" className="object-cover" />
              )}
              <button
                type="button"
                onClick={() => void discard(path)}
                aria-label="Remove this photo"
                className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-navy-950/70 text-white"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}

          {uploading && (
            <span className="grid size-16 place-items-center rounded-[1rem] border border-dashed border-hairline bg-canvas">
              <Loader2 className="size-4 animate-spin text-copy-muted" aria-hidden />
            </span>
          )}

          {evidence.length < MAX_EVIDENCE && !uploading && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="grid size-16 place-items-center rounded-[1rem] border border-dashed border-hairline bg-canvas text-copy-muted transition-colors hover:border-azure-300 hover:text-copy-muted"
            >
              <Camera className="size-5" aria-hidden />
              <span className="sr-only">Add a photo</span>
            </button>
          )}
        </div>

        <p className="text-[0.75rem] text-copy-muted">
          Photos help more than words here. Up to {MAX_EVIDENCE}.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_PHOTO_TYPES.join(",")}
          capture="environment"
          hidden
          aria-label="Photo of the problem"
          onChange={onPick}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="danger" shape="pill" disabled={pending}>
          {pending ? "Sending…" : "Report it"}
        </Button>
        <Button type="button" variant="ghost" shape="pill" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
