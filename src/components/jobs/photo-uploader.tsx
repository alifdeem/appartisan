"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, ImageOff, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { attachJobPhotoAction, removeJobPhotoAction } from "@/app/(app)/client/actions";
import {
  JOB_PHOTO_BUCKET,
  MAX_JOB_PHOTOS,
  MAX_PHOTO_BYTES,
  PHOTO_ACCEPT_ATTR,
  formatBytes,
  isAcceptedPhoto,
} from "@/lib/jobs/media";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import type { SignedPhoto } from "@/lib/jobs/queries";

/**
 * Photos of the problem.
 *
 * **The file never passes through a Server Action.** Action bodies are capped
 * at 1MB by default and the `job-photos` bucket accepts 10MB, so routing an
 * upload through one would fail on most phone photographs — and would double
 * the bytes over an expensive connection, since the file would travel to our
 * server and then on to storage. The browser uploads straight to Supabase,
 * where the same RLS policy that guards the table guards the bucket, and the
 * action is told only the resulting object name.
 *
 * Uploads run one at a time rather than with `Promise.all`. On a 3G connection
 * four parallel 4MB uploads do not finish four times faster; they finish at the
 * same time as each other, at the very end, with no usable progress in between.
 * Sequentially, the first photo lands in a few seconds and the user can see
 * that it is working.
 */

interface PendingUpload {
  key: string;
  name: string;
  previewUrl: string;
  /** 0–1. Coarse: the storage SDK reports completion, not byte progress. */
  done: boolean;
}

export function PhotoUploader({
  jobId,
  photos,
  disabled = false,
}: {
  jobId: string;
  photos: SignedPhoto[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<PendingUpload[]>([]);
  const [removing, setRemoving] = React.useState<string | null>(null);

  /**
   * A pending tile disappears the moment the server's list contains its object.
   *
   * Derived rather than reconciled in an effect: the effect version renders the
   * optimistic tile and the real one side by side for a frame, then removes
   * one — a visible duplicate and a cascading render. The answer is already
   * available during this render, so it is computed here.
   *
   * The object URLs are not revoked at this point. Entries stay in `pending`
   * until unmount, where the one cleanup releases them all; revoking a blob
   * still attached to a painted <img> would blank the tile mid-transition.
   */
  const knownObjects = React.useMemo(
    () => new Set(photos.map((photo) => photo.path.split("/").pop())),
    [photos],
  );
  const visiblePending = pending.filter((item) => !knownObjects.has(item.key));

  const total = photos.length + visiblePending.length;
  const remaining = MAX_JOB_PHOTOS - total;

  // Object URLs are a real allocation. Release them when the component goes.
  React.useEffect(() => {
    return () => {
      for (const item of pending) URL.revokeObjectURL(item.previewUrl);
    };
    // Intentionally on unmount only — per-item cleanup happens where it is removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(files: File[]) {
    const supabase = createClient();

    for (const file of files) {
      if (!isAcceptedPhoto(file)) {
        toast.error(`${file.name} is not a photo we can read.`);
        continue;
      }

      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(
          `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_PHOTO_BYTES)}.`,
        );
        continue;
      }

      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      // The object name is generated here, never taken from the file: a user's
      // own filename can contain anything, and the storage key is part of a
      // policy expression.
      const objectName = `${crypto.randomUUID()}.${extension}`;
      const previewUrl = URL.createObjectURL(file);
      const key = objectName;

      setPending((current) => [...current, { key, name: file.name, previewUrl, done: false }]);

      const { error } = await supabase.storage
        .from(JOB_PHOTO_BUCKET)
        .upload(`${jobId}/${objectName}`, file, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        console.error("[photos] upload failed", error);
        toast.error(`Could not upload ${file.name}.`);
        setPending((current) => current.filter((p) => p.key !== key));
        URL.revokeObjectURL(previewUrl);
        continue;
      }

      const result = await attachJobPhotoAction(jobId, objectName);

      if (!result.ok) {
        // The object landed but the row did not, so take the object back out
        // rather than leaving an unreferenced file in a private bucket.
        await supabase.storage.from(JOB_PHOTO_BUCKET).remove([`${jobId}/${objectName}`]);
        toast.error(result.error ?? "Could not attach that photo.");
        setPending((current) => current.filter((p) => p.key !== key));
        URL.revokeObjectURL(previewUrl);
        continue;
      }

      setPending((current) =>
        current.map((p) => (p.key === key ? { ...p, done: true } : p)),
      );
    }

    // Pull the server's list, which now has signed URLs for the new rows.
    router.refresh();
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // so picking the same file twice still fires

    if (files.length === 0) return;

    if (files.length > remaining) {
      toast.error(
        remaining === 0
          ? `You already have ${MAX_JOB_PHOTOS} photos.`
          : `You can add ${remaining} more photo${remaining === 1 ? "" : "s"}.`,
      );
    }

    void upload(files.slice(0, Math.max(0, remaining)));
  }

  async function remove(photoId: string) {
    setRemoving(photoId);
    const result = await removeJobPhotoAction(photoId);
    setRemoving(null);

    if (!result.ok) {
      toast.error(result.error ?? "Could not remove that photo.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {photos.map((photo) => (
          <figure
            key={photo.id}
            className="group relative aspect-square overflow-hidden rounded-[1.25rem] border border-hairline bg-azure-50"
          >
            {photo.url ? (
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="(max-width: 640px) 33vw, 160px"
                className="object-cover"
                unoptimized /* signed URL, expires — no point caching a derivative */
              />
            ) : (
              <div className="grid size-full place-items-center text-navy-800/35">
                <ImageOff className="size-5" aria-hidden />
              </div>
            )}

            {!disabled && (
              <button
                type="button"
                onClick={() => void remove(photo.id)}
                disabled={removing === photo.id}
                title="Remove photo"
                className={cn(
                  "absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full",
                  "bg-ink-950/60 text-white backdrop-blur-sm transition-all duration-[var(--duration-instant)]",
                  "hover:bg-ink-950/80 active:scale-90",
                  // Always visible on touch, where there is no hover to reveal it.
                  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                )}
              >
                {removing === photo.id ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <X className="size-3.5" aria-hidden />
                )}
                <span className="sr-only">Remove photo</span>
              </button>
            )}
          </figure>
        ))}

        {visiblePending.map((item) => (
          <div
            key={item.key}
            className="relative aspect-square overflow-hidden rounded-[1.25rem] border border-hairline bg-azure-50"
          >
            {/* Not next/image: this is a blob: URL for a file that may be HEIC,
                which the optimiser cannot process and Safari may not decode. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.previewUrl}
              alt=""
              className="size-full object-cover opacity-60"
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
            />
            <div className="absolute inset-0 grid place-items-center bg-ink-950/20">
              <Loader2 className="size-5 animate-spin text-white drop-shadow" aria-hidden />
            </div>
            <span className="sr-only">Uploading {item.name}</span>
          </div>
        ))}

        {!disabled && remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[1.25rem]",
              "border border-dashed border-hairline bg-azure-50/60 text-navy-800",
              "transition-colors duration-[var(--duration-fast)] ease-out-strong",
              "hover:border-azure-500 hover:bg-azure-50 active:scale-[0.98]",
            )}
          >
            {total === 0 ? (
              <Camera className="size-6" strokeWidth={1.75} aria-hidden />
            ) : (
              <Plus className="size-5" aria-hidden />
            )}
            <span className="text-2xs font-semibold">{total === 0 ? "Add photos" : "Add"}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT_ATTR}
        multiple
        // Offers the camera directly on Android and iOS, rather than making the
        // user go through the gallery to photograph something in front of them.
        capture="environment"
        aria-label="Add photos of the problem"
        onChange={onPick}
        className="sr-only"
        tabIndex={-1}
      />

      <p className="text-note text-copy-muted">
        {total === 0
          ? "A photo of the problem gets you a far more accurate price."
          : `${total} of ${MAX_JOB_PHOTOS} photos.`}
      </p>
    </div>
  );
}
