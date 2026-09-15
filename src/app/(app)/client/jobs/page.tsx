import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import { JobCard } from "@/components/jobs/job-card";
import { countPhotosByJob, listClientJobs } from "@/lib/jobs/queries";
import { jobStatus, type JobStatusGroup } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Job history" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "In progress" },
  { key: "closed", label: "Past" },
  { key: "draft", label: "Drafts" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

/**
 * Every job the client has ever posted.
 *
 * The filter is a query parameter rather than client state so a filtered view
 * is a link — shareable, bookmarkable, and unchanged by the back button. It
 * also means the list is rendered on the server in one pass instead of shipping
 * the whole history to the browser to be hidden with CSS.
 */
export default async function JobHistoryPage({ searchParams }: PageProps<"/client/jobs">) {
  const params = await searchParams;
  const raw = typeof params.filter === "string" ? params.filter : "all";
  const filter: FilterKey = FILTERS.some((f) => f.key === raw) ? (raw as FilterKey) : "all";

  const jobs = await listClientJobs();
  const photoCounts = await countPhotosByJob(jobs.map((job) => job.id));

  const counts = jobs.reduce<Record<JobStatusGroup, number>>(
    (acc, job) => {
      acc[jobStatus(job.status).group] += 1;
      return acc;
    },
    { draft: 0, active: 0, closed: 0 },
  );

  const visible =
    filter === "all" ? jobs : jobs.filter((job) => jobStatus(job.status).group === filter);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/client"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          My jobs
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-ink-900">Job history</h1>
            <p className="text-[0.9375rem] text-ink-600">
              {jobs.length === 0
                ? "Nothing here yet."
                : `${jobs.length} request${jobs.length === 1 ? "" : "s"} in total.`}
            </p>
          </div>

          <Link href="/client/post" className={cn(buttonVariants({ size: "md" }), "shrink-0")}>
            <Plus />
            Book a service
          </Link>
        </div>
      </div>

      {jobs.length > 0 && (
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter jobs">
          {FILTERS.map((option) => {
            const count =
              option.key === "all" ? jobs.length : counts[option.key as JobStatusGroup];
            const selected = filter === option.key;

            // A filter that would show nothing is not offered. An empty tab is
            // a dead end the user has to work out for themselves.
            if (count === 0 && option.key !== "all") return null;

            return (
              <Link
                key={option.key}
                href={option.key === "all" ? "/client/jobs" : `/client/jobs?filter=${option.key}`}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium",
                  "transition-colors duration-[var(--duration-fast)] ease-out-strong",
                  selected
                    ? "bg-ink-900 text-ink-0"
                    : "border border-ink-300 bg-ink-0 text-ink-700 hover:bg-ink-50",
                )}
              >
                {option.label}
                <span
                  className={cn(
                    "tabular font-mono text-xs",
                    selected ? "text-ink-0/70" : "text-ink-400",
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
        <div className="rounded-card border border-dashed border-ink-300 bg-ink-50 px-5 py-12 text-center">
          <p className="text-sm font-medium text-ink-800">
            {jobs.length === 0 ? "No jobs yet" : "Nothing in this view"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
            {jobs.length === 0
              ? "Once you post a request it will appear here, with everything that happened to it."
              : "Try another filter."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((job) => (
            <li key={job.id}>
              <JobCard job={job} photoCount={photoCounts[job.id] ?? 0} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
