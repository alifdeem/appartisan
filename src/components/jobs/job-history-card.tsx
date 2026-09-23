import Link from "next/link";
import { ChevronRight, ImageIcon, MapPin, Mic } from "lucide-react";

import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { JobThumb } from "@/components/jobs/job-thumb";
import { jobStatus } from "@/lib/jobs/status";
import { cn, timeAgo } from "@/lib/utils";
import type { JobWithCategory } from "@/lib/jobs/queries";

/**
 * One job in the history list.
 *
 * **Why this is not `JobCard`.** That card lives on the home screen, where it is
 * one of three rows under a heading and its job is to say "this is happening
 * now". Here it is one of forty and its job is "which one was this" — a
 * different question, answered by a photograph rather than by a line of
 * description. Two cards, two jobs; merging them would mean a `variant` prop
 * that changes everything about the component except its name.
 *
 * **The picture, in four tiers, all of them real:**
 *
 *   1. The **completion photograph** on a finished job — the artisan's proof the
 *      work was done, and the thing you are actually looking for when you scroll
 *      back to March.
 *   2. The **client's own request photograph** on anything unfinished — what
 *      matters there is "which problem was this".
 *   3. The **trade's photograph**, when the job carries none of its own.
 *   4. The trade's **icon** on the brand tint, when that has not been generated
 *      yet.
 *
 * No stock image is ever invented for a job. Every tier is either this job's
 * own photograph or an honest label for the kind of work it was.
 *
 * The thumbnail is square and fixed, so a row is the same height whether the
 * photograph is portrait, landscape or absent — which is what lets forty of
 * these be scanned rather than read. `JobThumb` owns the tiers, because two of
 * them can only be detected in the browser: a signed URL whose object is gone,
 * and one that has expired.
 */
export function JobHistoryCard({
  job,
  coverUrl,
  categoryUrl,
  photoCount = 0,
}: {
  job: JobWithCategory;
  /** A photograph belonging to this job, signed. */
  coverUrl?: string | null;
  /** The trade's own photograph, as the fallback. */
  categoryUrl?: string | null;
  photoCount?: number;
}) {
  const presentation = jobStatus(job.status);
  const isDraft = job.status === "draft";
  const href = isDraft ? `/client/post/${job.id}/describe` : `/client/jobs/${job.id}`;

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3.5 rounded-[1.25rem] border bg-white p-3",
        "shadow-[var(--shadow-float)]",
        "transition-[box-shadow,border-color,transform] duration-[var(--duration-fast)] ease-out-strong",
        "hover:-translate-y-0.5 hover:border-azure-300 hover:shadow-[var(--shadow-sheet)]",
        "active:translate-y-0 active:scale-[0.99]",
        isDraft ? "border-dashed border-hairline" : "border-hairline",
      )}
    >
      <JobThumb
        coverUrl={coverUrl ?? null}
        categoryUrl={categoryUrl ?? null}
        icon={job.category?.icon ?? "wrench"}
        count={photoCount}
      />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="truncate font-space text-note font-bold text-navy-900">
            {job.category?.name ?? "Service"}
          </h3>
          <JobStatusBadge status={job.status} />
        </div>

        <p className="line-clamp-1 text-note leading-snug text-copy-muted">
          {job.description?.trim() || presentation.blurb}
        </p>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-copy-muted">
          {!isDraft && <span className="tabular font-mono">{job.reference}</span>}

          {job.landmark && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{job.landmark}</span>
            </span>
          )}

          {/* The thumbnail already shows a count when the picture is one of
              this job's own, so this is the case where it is not: photographs
              exist but the row is showing the trade's stock image. */}
          {!coverUrl && photoCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <ImageIcon className="size-3" aria-hidden />
              {photoCount}
            </span>
          )}

          {job.voice_note_path && (
            <span className="inline-flex items-center gap-1">
              <Mic className="size-3" aria-hidden />
              Voice
            </span>
          )}

          <span className="ml-auto whitespace-nowrap">{timeAgo(job.created_at)}</span>
        </div>
      </div>

      <ChevronRight
        className="size-4 shrink-0 text-hairline transition-transform duration-[var(--duration-fast)] ease-out-strong group-hover:translate-x-0.5 group-hover:text-azure-500"
        aria-hidden
      />
    </Link>
  );
}
