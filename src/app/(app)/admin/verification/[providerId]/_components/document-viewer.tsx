"use client";

import * as React from "react";
import { Expand, ImageOff, X } from "lucide-react";

import { docLabel } from "@/lib/providers/documents";
import { cn } from "@/lib/utils";
import type { SignedDocument } from "@/lib/providers/queries";

/**
 * The documents, at the size an admin can actually read them.
 *
 * This is the one screen in the product where image fidelity is the job. The
 * whole verification decision turns on whether a name, a date of birth and a
 * card number are legible, so a thumbnail grid that looks tidy and has to be
 * squinted at would defeat the screen's only purpose.
 *
 * So: the documents render large in the flow, and any of them opens full-screen
 * on tap. Full-screen uses a native `<dialog>` — it gets focus trapping, Escape
 * to close, inertness of the page behind and top-layer stacking from the
 * platform, all of which a div would have to reimplement and would get subtly
 * wrong.
 *
 * `unoptimized` everywhere and plain `<img>` rather than `next/image`: these are
 * short-lived signed URLs to private objects. Running them through the image
 * optimiser would write a copy of somebody's Ghana Card into a CDN cache, which
 * is precisely the thing the private bucket exists to prevent.
 */
export function DocumentViewer({ documents }: { documents: SignedDocument[] }) {
  const [open, setOpen] = React.useState<SignedDocument | null>(null);
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  if (documents.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline bg-canvas px-5 py-10 text-center text-sm text-copy-muted">
        No documents uploaded.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-4">
        {documents.map((doc) => (
          <li key={doc.id} className="space-y-1.5">
            <p className="text-sm font-medium text-navy-900">{docLabel(doc.doc_type)}</p>

            {doc.url ? (
              <button
                type="button"
                onClick={() => setOpen(doc)}
                className={cn(
                  "group relative block w-full overflow-hidden rounded-card border border-hairline bg-azure-50",
                  "transition-[border-color,transform] duration-[var(--duration-fast)] ease-out-strong",
                  "hover:border-copy-muted active:scale-[0.995]",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={doc.url}
                  alt={docLabel(doc.doc_type)}
                  className="w-full object-contain"
                  loading="lazy"
                />

                <span
                  className={cn(
                    "absolute right-2.5 bottom-2.5 inline-flex items-center gap-1.5 rounded-full",
                    "bg-navy-950/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm",
                    "transition-opacity duration-[var(--duration-fast)]",
                    "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100",
                  )}
                >
                  <Expand className="size-3" aria-hidden />
                  Full size
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-card border border-danger-500/30 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                <ImageOff className="size-4 shrink-0" aria-hidden />
                This file could not be opened. Do not approve on the strength of the others.
              </div>
            )}
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        // Backdrop click. The dialog element itself fills the viewport, so a
        // click landing on it rather than on the image is a click outside.
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(null);
        }}
        className={cn(
          "m-auto max-h-[92dvh] max-w-[95vw] bg-transparent p-0 backdrop:bg-navy-950/80",
          "backdrop:backdrop-blur-sm open:animate-fade-in",
        )}
      >
        {open && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={open.url ?? ""}
              alt={docLabel(open.doc_type)}
              className="max-h-[92dvh] max-w-[95vw] rounded-card object-contain"
            />

            <button
              type="button"
              onClick={() => setOpen(null)}
              className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-navy-950/70 text-white backdrop-blur-sm transition-transform duration-[var(--duration-instant)] hover:bg-navy-950/85 active:scale-90"
            >
              <X className="size-5" aria-hidden />
              <span className="sr-only">Close</span>
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
