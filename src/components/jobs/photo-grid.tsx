import Image from "next/image";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SignedPhoto } from "@/lib/jobs/queries";

/**
 * A row of job photographs.
 *
 * Both job screens show pictures and both were doing it slightly differently —
 * a three-column grid on one, a four-column grid on the other, two different
 * radii, two different broken-image fallbacks. One component, because a
 * photograph of somebody's leaking pipe is the same object on both screens.
 *
 * **Square and scrolling rather than a wrapping grid.** A wrapping grid of
 * three-per-row leaves a ragged last row on four photos and pushes everything
 * below it down as more are added. A single scrolling row is a fixed height
 * whatever the count, which is what lets these sit in the middle of a long
 * screen without moving the sections under them.
 *
 * `photo.url` is null when signing failed — the URLs are deliberately
 * short-lived (a job photo can show the inside of somebody's home), so an
 * expired or missing object is a normal outcome, not an error worth a message.
 * It gets a placeholder tile rather than a broken image icon from the browser.
 */
export function PhotoGrid({ photos, className }: { photos: SignedPhoto[]; className?: string }) {
  if (photos.length === 0) return null;

  return (
    <ul
      className={cn(
        "-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {photos.map((photo) => (
        <li
          key={photo.id}
          className="relative size-28 shrink-0 overflow-hidden rounded-[1rem] border border-hairline bg-canvas"
        >
          {photo.url ? (
            <Image
              src={photo.url}
              alt=""
              fill
              sizes="112px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="grid size-full place-items-center text-copy-muted">
              <ImageOff className="size-5" aria-hidden />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
