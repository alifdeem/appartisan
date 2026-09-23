import Link from "next/link";
import { ChevronRight, ImageIcon, MapPin, Mic } from "lucide-react";

import { CategoryIcon } from "@/components/marketplace/category-icon";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { jobStatus } from "@/lib/jobs/status";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { JobWithCategory } from "@/lib/jobs/queries";

/**
 * One job in a list.
 *
 * A draft links back into the posting flow where the client left off; anything
 * posted links to the job screen. That is the whole navigational model of the
 * client side, and keeping it inside the card means no list has to reimplement
 * it and get it subtly different.
 *
 * The reference sets in mono — it is an identifier a client will read down the
 * phone to support, and mono is what makes `AGH-260914-4F2A1` legible when read
 * aloud (PLAN.md / DESIGN.md: anything that is a quantity or an identifier is
 * mono with tabular figures).
 */
export function JobCard({
  job,
  photoCount = 0,
}: {
  job: JobWithCategory;
  photoCount?: number;
}) {
  const presentation = jobStatus(job.status);
  const isDraft = job.status === "draft";

  const href = isDraft ? `/client/post/${job.id}/describe` : `/client/jobs/${job.id}`;

  return (
    <Link
      href={href}
      className={cn(
        // Recoloured for the 2026 reference: cool hairline, navy-tinted lift.
        // Used by the home screen and the jobs list, so both move together.
        "group block rounded-[1.25rem] border bg-white shadow-[var(--shadow-float)]",
        "transition-[box-shadow,border-color,transform] duration-[var(--duration-fast)] ease-out-strong",
        "hover:-translate-y-0.5 hover:border-azure-300 hover:shadow-[var(--shadow-sheet)] active:translate-y-0",
        isDraft ? "border-dashed border-hairline" : "border-hairline",
      )}
    >
      <div className="flex items-start gap-3.5 p-4">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-[0.875rem]",
            isDraft ? "bg-azure-50 text-copy-muted" : "bg-azure-50 text-navy-800",
          )}
        >
          <CategoryIcon name={job.category?.icon ?? "wrench"} />
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate font-space text-[0.9375rem] font-bold text-navy-900">
              {job.category?.name ?? "Service"}
            </h3>
            <JobStatusBadge status={job.status} />
          </div>

          <p className="line-clamp-2 text-sm leading-snug text-copy-muted">
            {job.description?.trim() || presentation.blurb}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-copy-muted">
            {!isDraft && <span className="tabular font-mono">{job.reference}</span>}

            {job.landmark && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{job.landmark}</span>
              </span>
            )}

            {photoCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <ImageIcon className="size-3.5" aria-hidden />
                {photoCount}
              </span>
            )}

            {job.voice_note_path && (
              <span className="inline-flex items-center gap-1">
                <Mic className="size-3.5" aria-hidden />
                Voice
              </span>
            )}

            <span className="ml-auto whitespace-nowrap">{timeAgo(job.created_at)}</span>
          </div>
        </div>

        <ChevronRight
          className="mt-2.5 size-4 shrink-0 text-hairline transition-transform duration-[var(--duration-fast)] ease-out-strong group-hover:translate-x-0.5 group-hover:text-azure-500"
          aria-hidden
        />
      </div>
    </Link>
  );
}
