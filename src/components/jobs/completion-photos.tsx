"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { attachCompletionPhotoAction } from "@/app/(app)/provider/actions";
import { ACCEPTED_PHOTO_TYPES, JOB_PHOTO_BUCKET, MAX_PHOTO_BYTES } from "@/lib/jobs/media";
import { createClient } from "@/lib/supabase/browser";
import type { SignedPhoto } from "@/lib/jobs/queries";

/**
 * Photos of the finished work.
 *
 * The artisan's, not the client's — which is why it does not reuse
 * `PhotoUploader`: that one attaches through an action requiring the caller to
 * own the job *as a client* and the job to still be a draft, and the artisan
 * is neither.
 *
 * These are load-bearing twice over. `advance_job_execution` will not move the
 * job to `awaiting_signoff` without one (0015), and they are what the client
 * signs off on and what settles a dispute weeks later.
 *
 * As everywhere else, bytes go straight to Storage and only the path travels
 * through the Server Action — an action body is capped at 1MB and a phone
 * photo is not.
 */
export function CompletionPhotos({ jobId, photos }: { jobId: string; photos: SignedPhoto[] }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

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

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const objectName = `completion-${crypto.randomUUID()}.${extension}`;

    setUploading(true);
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(JOB_PHOTO_BUCKET)
      .upload(`${jobId}/${objectName}`, file, { contentType: file.type, upsert: false });

    if (error) {
      setUploading(false);
      console.error("[completion] upload failed", error);
      toast.error("Could not upload that photo. Check your connection.");
      return;
    }

    const result = await attachCompletionPhotoAction(jobId, objectName);
    setUploading(false);

    if (!result.ok) {
      // The object landed but the row did not. Take it back out rather than
      // leaving an orphan in the bucket.
      await supabase.storage.from(JOB_PHOTO_BUCKET).remove([`${jobId}/${objectName}`]);
      toast.error(result.error ?? "Could not save that photo.");
      return;
    }

    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-card border border-ink-200 bg-ink-0 p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-ink-900">Photos of the finished work</h2>
        <p className="mt-0.5 text-sm text-ink-600">
          The client signs off on these, and they settle any question later. Two or three is plenty.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {photos.map((photo) => (
          <span
            key={photo.id}
            className="relative size-20 overflow-hidden rounded-field border border-ink-200 bg-ink-100"
          >
            {photo.url && <Image src={photo.url} alt="" fill sizes="80px" className="object-cover" />}
          </span>
        ))}

        {uploading && (
          <span className="grid size-20 place-items-center rounded-field border border-dashed border-ink-300 bg-ink-25">
            <Loader2 className="size-4 animate-spin text-ink-400" aria-hidden />
          </span>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="grid size-20 place-items-center rounded-field border border-dashed border-ink-300 bg-ink-25 text-ink-500 transition-colors hover:border-ink-400 hover:text-ink-700 disabled:opacity-50"
        >
          <Camera className="size-6" aria-hidden />
          <span className="sr-only">Add a photo of the finished work</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_PHOTO_TYPES.join(",")}
        capture="environment"
        hidden
        onChange={onPick}
      />
    </section>
  );
}
