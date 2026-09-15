"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  attachProviderDocumentAction,
  removeProviderDocumentAction,
} from "@/app/(app)/provider/actions";
import {
  DOC_ACCEPT_ATTR,
  MAX_DOC_BYTES,
  PROVIDER_DOC_BUCKET,
  type DocSpec,
  isAcceptedDoc,
} from "@/lib/providers/documents";
import { formatBytes } from "@/lib/jobs/media";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import type { SignedDocument } from "@/lib/providers/queries";

/**
 * One identity document.
 *
 * **The file never passes through a Server Action**, for the same two reasons as
 * the job photo uploader: action bodies are capped at 1MB and this bucket takes
 * 10MB, and routing it through our server would double the bytes over an
 * expensive connection. The browser uploads straight to Supabase, where the same
 * policy that guards the table guards the bucket, and the action is told only
 * the resulting object name.
 *
 * **Why a filled tile still shows the photograph.** The temptation is to collapse
 * it to a green tick and a filename — it is tidier, and it is wrong. The single
 * most common defect in an artisan's application is a Ghana Card photographed at
 * an angle, in shadow, or with a thumb over the barcode. The person who can
 * cheapest fix that is the artisan, standing where they took it, ten seconds
 * later. They can only fix what they can see.
 *
 * **Why the frame is card-shaped.** ID-1 is 1.586:1, and a tile at that ratio
 * silently teaches the framing before the shutter is pressed. A square slot
 * produces square photographs of a rectangular card.
 */

const ID_CARD_RATIO = "aspect-[1.586/1]";

interface Pending {
  key: string;
  previewUrl: string;
}

export function DocumentCapture({
  spec,
  providerId,
  documents,
  disabled = false,
}: {
  spec: DocSpec;
  providerId: string;
  /** Every document already filed under this type. One, for the singletons. */
  documents: SignedDocument[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);

  const multiple = spec.type === "work_photo" || spec.type === "certificate";
  const filled = documents.length > 0;
  const busy = pending !== null;

  React.useEffect(() => {
    return () => {
      if (pending) URL.revokeObjectURL(pending.previewUrl);
    };
    // Release on unmount only; the per-item release happens where it is cleared.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(file: File) {
    if (!isAcceptedDoc(file)) {
      toast.error("That is not a photo we can read. Use your camera.");
      return;
    }

    if (file.size > MAX_DOC_BYTES) {
      toast.error(
        `That photo is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_DOC_BYTES)}.`,
      );
      return;
    }

    const extension =
      file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    // Generated here, never taken from the file: a user's own filename can
    // contain anything, and the storage key is part of a policy expression.
    const objectName = `${spec.type}-${crypto.randomUUID()}.${extension}`;
    const previewUrl = URL.createObjectURL(file);

    setPending({ key: objectName, previewUrl });

    const supabase = createClient();
    const { error } = await supabase.storage
      .from(PROVIDER_DOC_BUCKET)
      .upload(`${providerId}/${objectName}`, file, { contentType: file.type, upsert: false });

    if (error) {
      console.error("[docs] upload failed", error);
      toast.error("Could not upload that photo. Check your connection.");
      setPending(null);
      URL.revokeObjectURL(previewUrl);
      return;
    }

    const result = await attachProviderDocumentAction(spec.type, objectName);

    if (!result.ok) {
      // The object landed but the row did not. Take the object back out rather
      // than leaving an unreferenced identity document in a private bucket.
      await supabase.storage.from(PROVIDER_DOC_BUCKET).remove([`${providerId}/${objectName}`]);
      toast.error(result.error ?? "Could not save that photo.");
      setPending(null);
      URL.revokeObjectURL(previewUrl);
      return;
    }

    setPending(null);
    URL.revokeObjectURL(previewUrl);
    router.refresh();
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so retaking the same shot still fires
    if (file) void upload(file);
  }

  async function remove(documentId: string) {
    setRemoving(documentId);
    const result = await removeProviderDocumentAction(documentId);
    setRemoving(null);

    if (!result.ok) {
      toast.error(result.error ?? "Could not remove that.");
      return;
    }

    router.refresh();
  }

  const frameRatio = spec.type === "selfie" ? "aspect-[4/5]" : ID_CARD_RATIO;

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-800">
          {spec.label}
          {filled && !multiple && (
            <Check className="size-4 text-success-600 animate-fade-in" aria-label="Uploaded" />
          )}
        </h3>
        {filled && !multiple && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 transition-colors hover:text-brand-800"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Retake
          </button>
        )}
      </div>

      {multiple ? (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {documents.map((doc) => (
            <Thumb
              key={doc.id}
              url={doc.url}
              onRemove={disabled ? undefined : () => void remove(doc.id)}
              removing={removing === doc.id}
            />
          ))}
          {pending && <Thumb url={pending.previewUrl} uploading />}
          {!disabled && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-card",
                "border border-dashed border-ink-300 bg-ink-50 text-ink-500",
                "transition-colors duration-[var(--duration-fast)] ease-out-strong",
                "hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700 active:scale-[0.98]",
                "disabled:opacity-50",
              )}
            >
              <Camera className="size-5" strokeWidth={1.75} aria-hidden />
              <span className="text-xs font-medium">Add</span>
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && inputRef.current?.click()}
          disabled={disabled || busy}
          className={cn(
            "group relative block w-full overflow-hidden rounded-card",
            frameRatio,
            "transition-[border-color,background-color,transform] duration-[var(--duration-fast)] ease-out-strong",
            filled || pending
              ? "border border-ink-200 bg-ink-100"
              : "border border-dashed border-ink-300 bg-ink-50",
            !disabled && "hover:border-brand-600 active:scale-[0.99]",
            "disabled:cursor-default disabled:opacity-70",
            spec.type === "selfie" && "mx-auto max-w-[15rem]",
          )}
        >
          {pending ? (
            <>
              {/* Not next/image: a blob: URL for a file that may be HEIC, which
                  the optimiser cannot process and Safari may not decode. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pending.previewUrl} alt="" className="size-full object-cover opacity-60" />
              <span className="absolute inset-0 grid place-items-center bg-ink-950/25">
                <Loader2 className="size-6 animate-spin text-white drop-shadow" aria-hidden />
              </span>
            </>
          ) : documents[0]?.url ? (
            <Image
              src={documents[0].url}
              alt={spec.label}
              fill
              sizes="(max-width: 640px) 90vw, 420px"
              className="object-cover"
              unoptimized /* signed URL, expires — no point caching a derivative */
            />
          ) : filled ? (
            <span className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-ink-500">
              Uploaded, but we cannot show it right now.
            </span>
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <Camera
                className="size-7 text-ink-400 transition-colors group-hover:text-brand-600"
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="text-sm leading-snug font-medium text-ink-700">{spec.hint}</span>
            </span>
          )}
        </button>
      )}

      {!multiple && !filled && (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-ink-500">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-ink-400" aria-hidden />
          Only our verification team sees this. It is never shown to clients.
        </p>
      )}

      {multiple && <p className="text-xs text-ink-500">{spec.hint}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={DOC_ACCEPT_ATTR}
        // Opens the right camera directly instead of sending someone through
        // the gallery to photograph a card that is in their other hand.
        capture={spec.capture}
        onChange={onPick}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}

function Thumb({
  url,
  onRemove,
  removing = false,
  uploading = false,
}: {
  url: string | null;
  onRemove?: () => void;
  removing?: boolean;
  uploading?: boolean;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-card border border-ink-200 bg-ink-100">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className={cn("size-full object-cover", uploading && "opacity-60")}
          onError={(event) => {
            event.currentTarget.style.visibility = "hidden";
          }}
        />
      )}

      {uploading && (
        <span className="absolute inset-0 grid place-items-center bg-ink-950/20">
          <Loader2 className="size-5 animate-spin text-white drop-shadow" aria-hidden />
        </span>
      )}

      {onRemove && !uploading && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          title="Remove"
          className={cn(
            "absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full",
            "bg-ink-950/60 text-white backdrop-blur-sm transition-all duration-[var(--duration-instant)]",
            "hover:bg-ink-950/80 active:scale-90",
            // Always visible on touch, where there is no hover to reveal it.
            "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
          )}
        >
          {removing ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-3.5" aria-hidden />
          )}
          <span className="sr-only">Remove</span>
        </button>
      )}
    </div>
  );
}
