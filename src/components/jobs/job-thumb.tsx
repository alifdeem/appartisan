"use client";

import * as React from "react";
import Image from "next/image";

import { CategoryIcon } from "@/components/marketplace/category-icon";

/**
 * The square picture on a history row, with its fallbacks wired to what
 * actually happens rather than to what is in the database.
 *
 * **Why this is a Client Component when the card around it is not.** Supabase
 * signs a storage path without checking that an object is there, so a
 * `job_photos` row whose file has been removed yields a perfectly valid URL
 * that 404s. Signed URLs also expire — ten minutes here — so a tab left open
 * over lunch comes back to a page full of dead image links. Neither case is
 * visible to the server: the only place that knows the picture failed is the
 * browser, in `onError`.
 *
 * So the tiers degrade at the point of failure rather than at the point of
 * query: the job's own photograph, then the trade's, then the trade's icon.
 * A client's record of work in their home should never show a broken-image
 * glyph.
 */
export function JobThumb({
  coverUrl,
  categoryUrl,
  icon,
  count = 0,
}: {
  coverUrl: string | null;
  categoryUrl: string | null;
  icon: string;
  /** Photos attached to this job. Only shown when the picture is one of them. */
  count?: number;
}) {
  // `useState` seeded from props and then owned locally: a failure is browser
  // state, and re-deriving it from props on every render would undo it.
  const [coverFailed, setCoverFailed] = React.useState(false);
  const [categoryFailed, setCategoryFailed] = React.useState(false);

  const showCover = Boolean(coverUrl) && !coverFailed;
  const showCategory = !showCover && Boolean(categoryUrl) && !categoryFailed;
  const src = showCover ? coverUrl : showCategory ? categoryUrl : null;

  return (
    <div className="relative size-[4.5rem] shrink-0 overflow-hidden rounded-[0.875rem] bg-azure-50">
      {src ? (
        <Image
          // Keyed by src so swapping to the fallback remounts the element —
          // without it React keeps the failed <img> and never retries.
          key={src}
          src={src}
          alt=""
          fill
          sizes="72px"
          // A signed URL expires, so there is no derivative worth caching.
          unoptimized={showCover}
          onError={() => (showCover ? setCoverFailed(true) : setCategoryFailed(true))}
          className="object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center bg-linear-to-br from-azure-50 to-azure-100 text-navy-800/30"
        >
          <CategoryIcon name={icon} className="size-7" />
        </span>
      )}

      {/* Counted only when the picture is the job's own — a count over the
          trade's stock photograph would be counting the wrong thing. */}
      {showCover && count > 1 && (
        <span className="tabular absolute right-1 bottom-1 rounded-full bg-navy-950/70 px-1.5 font-mono text-[0.625rem] font-semibold text-white">
          {count}
        </span>
      )}
    </div>
  );
}
