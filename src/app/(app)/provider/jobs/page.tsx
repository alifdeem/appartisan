import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, MapPin } from "lucide-react";

import { CategoryIcon } from "@/components/marketplace/category-icon";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { getMyProvider } from "@/lib/providers/queries";
import { jobStatus, type JobStatusGroup } from "@/lib/jobs/status";
import { listProviderJobs } from "@/lib/jobs/matching";
import { cn, timeAgo } from "@/lib/utils";
import type { JobWithCategory } from "@/lib/jobs/queries";

export const metadata: Metadata = { title: "Your jobs" };

const FILTERS = [
  { key: "active", label: "On now" },
  { key: "closed", label: "Finished" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

/**
 * Every job assigned to this artisan.
 *
 * **"On now" is the default, not "All".** The client's history opens on
 * everything because they are looking back. An artisan opening this tab is at
 * work: the job they are on is the only one that can be acted on, and it should
 * not be three scrolls below a year of finished ones.
 *
 * **No photographs.** The client's history uses pictures because they are
 * recognising a room in their own house. An artisan recognises a job by trade,
 * landmark and state — they were there — and a stock photograph of someone else
 * doing their trade on every row would be decoration standing where information
 * belongs.
 *
 * The list is ordered by `updated_at` (from `listProviderJobs`), which for
 * work in hand means "what moved most recently" — the right order for a screen
 * whose job is "what needs me next".
 */
export default async function ProviderJobsPage({ searchParams }: PageProps<"/provider/jobs">) {
  const provider = await getMyProvider();
  if (!provider) redirect("/");

  const params = await searchParams;
  const raw = typeof params.filter === "string" ? params.filter : "active";
  const filter: FilterKey = FILTERS.some((f) => f.key === raw) ? (raw as FilterKey) : "active";

  const jobs = await listProviderJobs();

  const counts = jobs.reduce<Record<JobStatusGroup, number>>(
    (acc, job) => {
      acc[jobStatus(job.status).group] += 1;
      return acc;
    },
    { draft: 0, active: 0, closed: 0 },
  );

  const visible = jobs.filter((job) => jobStatus(job.status).group === filter);

  return (
    <div className="space-y-6 pb-28">
      <header className="space-y-1.5">
        <h1 className="font-space text-title font-bold text-navy-900">Your jobs</h1>
        <p className="text-note text-copy-muted">
          {counts.active > 0
            ? `${counts.active} on now, ${counts.closed} finished.`
            : jobs.length > 0
              ? `Nothing on right now. ${counts.closed} finished.`
              : "Nothing yet."}
        </p>
      </header>

      {jobs.length > 0 && (
        <nav aria-label="Filter jobs" className="flex gap-2">
          {FILTERS.map((option) => {
            const count = counts[option.key];
            const selected = filter === option.key;

            return (
              <Link
                key={option.key}
                href={`/provider/jobs?filter=${option.key}`}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-note font-semibold",
                  "transition-[background-color,border-color,color] duration-[var(--duration-fast)] ease-out-strong",
                  selected
                    ? "bg-linear-to-b from-navy-800 to-navy-900 text-white shadow-[var(--shadow-glow-navy)]"
                    : "border border-hairline bg-white text-navy-900 hover:border-azure-300 hover:bg-azure-50",
                )}
              >
                {option.label}
                <span
                  className={cn(
                    "tabular font-mono text-2xs",
                    selected ? "text-white/70" : "text-copy-muted",
                  )}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      {visible.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-hairline bg-azure-50/50 px-5 py-12 text-center">
          <p className="font-space text-note font-bold text-navy-900">
            {filter === "active" ? "Nothing on right now" : "Nothing finished yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-xs text-note leading-relaxed text-copy-muted">
            {filter === "active"
              ? "Go online and jobs near you will be offered to you."
              : "Jobs you complete and get paid for will be listed here."}
          </p>
          {filter === "active" && (
            <Link
              href="/provider"
              className="tap mt-4 inline-block text-note font-semibold text-azure-600 underline-offset-4 hover:underline"
            >
              Go to Today
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((job) => (
            <li key={job.id}>
              <ProviderJobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One assigned job.
 *
 * The **next action** is the loudest line, because it is the whole reason an
 * artisan is on this screen. `jobStatus().blurb` already phrases each state
 * from the reader's side, so the card does not restate it in its own words and
 * drift out of sync with the status machine.
 */
function ProviderJobCard({ job }: { job: JobWithCategory }) {
  const presentation = jobStatus(job.status);
  const live = presentation.group === "active";

  return (
    <Link
      href={`/provider/jobs/${job.id}`}
      className={cn(
        "group flex items-start gap-3.5 rounded-[1.25rem] border bg-white p-4",
        "shadow-[var(--shadow-float)]",
        "transition-[box-shadow,border-color,transform] duration-[var(--duration-fast)] ease-out-strong",
        "hover:-translate-y-0.5 hover:border-azure-300 hover:shadow-[var(--shadow-sheet)]",
        "active:translate-y-0 active:scale-[0.99]",
        live ? "border-azure-200" : "border-hairline",
      )}
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-[0.875rem]",
          live ? "bg-navy-800 text-white" : "bg-azure-50 text-navy-800",
        )}
      >
        <CategoryIcon name={job.category?.icon ?? "wrench"} />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="truncate font-space text-note font-bold text-navy-900">
            {job.category?.name ?? "Job"}
          </h3>
          <JobStatusBadge status={job.status} />
        </div>

        {/* The artisan's voice, not the client's — see `providerBlurb` in
            `status.ts`. Falls back to the label rather than to `blurb`, which
            would address them as the person who booked the work. */}
        <p className="line-clamp-2 text-note leading-snug text-copy-muted">
          {presentation.providerBlurb ?? presentation.label}
        </p>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5 text-2xs text-copy-muted">
          <span className="tabular font-mono">{job.reference}</span>

          {job.landmark && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{job.landmark}</span>
            </span>
          )}

          <span className="ml-auto whitespace-nowrap">{timeAgo(job.updated_at)}</span>
        </div>
      </div>

      <ChevronRight
        className="mt-2.5 size-4 shrink-0 text-hairline transition-transform duration-[var(--duration-fast)] ease-out-strong group-hover:translate-x-0.5 group-hover:text-azure-500"
        aria-hidden
      />
    </Link>
  );
}
