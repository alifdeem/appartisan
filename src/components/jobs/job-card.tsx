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
        // `bg-white`, not `ink-0`: these now sit on the client shell's pure
        // white ground, where the warm fill reads as a smudge rather than as a
        // raised surface. Same reason the `outline` button variant exists.
        "group block rounded-card border bg-white shadow-sm",
        "transition-[box-shadow,border-color,transform] duration-[var(--duration-fast)] ease-out-strong",
        "hover:-translate-y-px hover:border-ink-300 hover:shadow-md active:translate-y-0 active:shadow-sm",
        isDraft ? "border-dashed border-ink-300" : "border-ink-200",
      )}
    >
      <div className="flex items-start gap-3.5 p-4">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-field",
            isDraft ? "bg-ink-100 text-ink-500" : "bg-brand-50 text-brand-700",
          )}
        >
          <CategoryIcon name={job.category?.icon ?? "wrench"} />
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[0.9375rem] font-semibold text-ink-900">
              {job.category?.name ?? "Service"}
            </h3>
            <JobStatusBadge status={job.status} />
          </div>

          <p className="line-clamp-2 text-sm leading-snug text-ink-600">
            {job.description?.trim() || presentation.blurb}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-ink-500">
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
          className="mt-2.5 size-4 shrink-0 text-ink-300 transition-transform duration-[var(--duration-fast)] ease-out-strong group-hover:translate-x-0.5 group-hover:text-ink-500"
          aria-hidden
        />
      </div>
    </Link>
  );
}
