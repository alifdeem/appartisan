import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { JobHistoryCard } from "@/components/jobs/job-history-card";
import { buttonVariants } from "@/components/ui/button-variants";
import { categoryPhotoMap } from "@/lib/images";
import { countPhotosByJob, coverPhotoByJob, listClientJobs } from "@/lib/jobs/queries";
import { jobStatus, type JobStatusGroup } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Your jobs" };

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
 * **What this screen is for, which decided everything else.** It is not a table
 * of records — it is the client's evidence that work happened in their home.
 * Six months on, the useful question is not "what was reference AGH-260917-DF015"
 * but "which one was the bathroom", and the fastest possible answer to that is
 * the photograph they took at the time. So every row carries a picture, and the
 * picture is the job's own wherever one exists. See `JobHistoryCard` for the
 * four tiers and why they are ordered as they are.
 *
 * **The filter stays a query parameter**, not client state: a filtered view is
 * then a link — shareable, bookmarkable, survives the back button — and the
 * list is rendered on the server in one pass rather than shipping the whole
 * history to the browser to be hidden with CSS. The tabs look like the
 * segmented control elsewhere in the app and behave like links, which is the
 * honest thing for a control that changes the URL.
 *
 * **A tab with nothing in it is not offered.** An empty tab is a dead end the
 * reader has to work out for themselves.
 *
 * Money is deliberately absent from these rows. A job's cost lives on a quote,
 * and reading one quote per row would be a query per job to render a figure
 * that is meaningless until it has been accepted. The job screen shows it.
 */
export default async function JobHistoryPage({ searchParams }: PageProps<"/client/jobs">) {
  const params = await searchParams;
  const raw = typeof params.filter === "string" ? params.filter : "all";
  const filter: FilterKey = FILTERS.some((f) => f.key === raw) ? (raw as FilterKey) : "all";

  const jobs = await listClientJobs();

  const [photoCounts, covers] = await Promise.all([
    countPhotosByJob(jobs.map((job) => job.id)),
    coverPhotoByJob(jobs.map((job) => job.id)),
  ]);

  // The trade photographs, as the fallback for a job with no pictures of its
  // own. Deduplicated, because forty jobs across six trades is six lookups.
  const categoryPhotos = categoryPhotoMap([
    ...new Set(jobs.map((job) => job.category?.slug).filter((slug) => slug !== undefined)),
  ]);

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
    // pb-28 clears the fixed tab bar.
    <div className="space-y-6 pb-28">
      <header className="space-y-4">
        <Link
          href="/client"
          aria-label="Go back"
          className="-ml-2 grid size-11 place-items-center rounded-full text-navy-900 transition-colors duration-[var(--duration-instant)] hover:bg-azure-50"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>

        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <h1 className="font-space text-title font-bold text-navy-900">Your jobs</h1>
            <p className="text-note text-copy-muted">
              {jobs.length === 0
                ? "Nothing here yet."
                : `${jobs.length} request${jobs.length === 1 ? "" : "s"}, oldest at the bottom.`}
            </p>
          </div>

          <Link
            href="/client/post"
            aria-label="Book a service"
            className={cn(
              buttonVariants({ variant: "navy", size: "icon", shape: "pill" }),
              "shrink-0",
            )}
          >
            <Plus />
          </Link>
        </div>
      </header>

      {jobs.length > 0 && (
        <nav aria-label="Filter jobs" className="-mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex gap-2">
            {FILTERS.map((option) => {
              const count =
                option.key === "all" ? jobs.length : counts[option.key as JobStatusGroup];
              const selected = filter === option.key;

              if (count === 0 && option.key !== "all") return null;

              return (
                <li key={option.key}>
                  <Link
                    href={option.key === "all" ? "/client/jobs" : `/client/jobs?filter=${option.key}`}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-note font-semibold whitespace-nowrap",
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
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {visible.length === 0 ? (
        <EmptyState hasAnyJobs={jobs.length > 0} />
      ) : (
        <ul className="space-y-2.5">
          {visible.map((job) => (
            <li key={job.id}>
              <JobHistoryCard
                job={job}
                coverUrl={covers[job.id] ?? null}
                categoryUrl={job.category ? (categoryPhotos[job.category.slug] ?? null) : null}
                photoCount={photoCounts[job.id] ?? 0}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Two empty states, not one.
 *
 * "No jobs yet" on a brand-new account is an invitation and gets the button.
 * "Nothing in this view" behind a filter is a navigational dead end, and
 * offering to post a job there answers a question nobody asked — the way out is
 * back to the full list.
 */
function EmptyState({ hasAnyJobs }: { hasAnyJobs: boolean }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-hairline bg-azure-50/50 px-5 py-12 text-center">
      <p className="font-space text-note font-bold text-navy-900">
        {hasAnyJobs ? "Nothing in this view" : "No jobs yet"}
      </p>
      <p className="mx-auto mt-1.5 max-w-xs text-note leading-relaxed text-copy-muted">
        {hasAnyJobs
          ? "Nothing matches this filter right now."
          : "Post a request and it will appear here, with everything that happened to it."}
      </p>

      {hasAnyJobs ? (
        <Link
          href="/client/jobs"
          className="tap mt-4 inline-block text-note font-semibold text-azure-600 underline-offset-4 hover:underline"
        >
          Show all jobs
        </Link>
      ) : (
        <Link
          href="/client/post"
          className={cn(buttonVariants({ variant: "navy", size: "lg", shape: "pill" }), "mt-5")}
        >
          <Plus />
          Book a service
        </Link>
      )}
    </div>
  );
}
