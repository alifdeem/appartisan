import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/card";
import { LiveBoard } from "@/components/admin/live-board";
import { JOBS_PER_PAGE, listAllJobs, type JobFilter } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Jobs" };

const FILTERS: ReadonlyArray<{ key: JobFilter; label: string }> = [
  { key: "live", label: "Running" },
  { key: "closed", label: "Finished" },
  { key: "all", label: "Everything" },
];

/**
 * Every job on the platform.
 *
 * The overview's board shows eight rows because it is a summary. This is the
 * page it summarises: the same table, the same vocabulary, no cap.
 *
 * **Running is not the default. Everything is.** The console's front page
 * already answers "what is happening now". Somebody who navigates here has a
 * different question - usually about one specific job, often one that
 * finished - so the list opens on all of it and the filter is one tap away.
 *
 * Filter and page live in the URL, so a row an operator is looking at can be
 * sent to somebody else as a link.
 */
export default async function AdminJobsPage({ searchParams }: PageProps<"/admin/jobs">) {
  const params = await searchParams;

  const raw = typeof params.filter === "string" ? params.filter : "all";
  const filter: JobFilter = FILTERS.some((f) => f.key === raw) ? (raw as JobFilter) : "all";
  const page = Math.max(0, Number(params.page) || 0);
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 40) : "";

  const { rows, total, counts } = await listAllJobs({ filter, page, search: search || undefined });

  const from = page * JOBS_PER_PAGE;
  const showing = rows?.length ?? 0;
  const hasPrev = page > 0;
  const hasNext = from + showing < total;

  const href = (next: Partial<{ filter: JobFilter; page: number; q: string }>) => {
    const sp = new URLSearchParams();
    const f = next.filter ?? filter;
    const p = next.page ?? 0;
    const q = next.q ?? search;
    if (f !== "all") sp.set("filter", f);
    if (p > 0) sp.set("page", String(p));
    if (q) sp.set("q", q);
    const s = sp.toString();
    return s ? `/admin/jobs?${s}` : "/admin/jobs";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-space text-title font-bold text-navy-900">Jobs</h1>
          <p className="mt-1 text-note text-copy-muted">
            {search
              ? `${total} matching “${search}”.`
              : `${counts.all} in total. ${counts.live} running, ${counts.closed} finished.`}
          </p>
        </div>

        {/* GET, not a Server Action: this is a read, so it belongs in the URL
            where it can be bookmarked, shared and gone back to. */}
        <form action="/admin/jobs" className="flex items-center gap-2">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-copy-muted"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Job reference"
              aria-label="Search by job reference"
              className={cn(
                "h-10 w-56 rounded-[0.75rem] border border-hairline bg-white pr-3 pl-9",
                "text-note text-copy placeholder:text-copy-muted",
                "transition-[border-color,box-shadow] duration-[var(--duration-fast)]",
                "focus:border-azure-400 focus:ring-2 focus:ring-azure-500/20 focus:outline-none",
              )}
            />
          </div>
        </form>
      </header>

      <nav aria-label="Filter jobs" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => {
          const selected = filter === option.key;
          return (
            <Link
              key={option.key}
              href={href({ filter: option.key, page: 0 })}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-note font-semibold",
                "transition-[background-color,border-color,color] duration-[var(--duration-fast)] ease-out-strong",
                selected
                  ? "bg-navy-800 text-white"
                  : "border border-hairline bg-white text-copy hover:border-azure-300 hover:bg-azure-50",
              )}
            >
              {option.label}
              <span
                className={cn(
                  "tabular font-mono text-2xs",
                  selected ? "text-white/70" : "text-copy-muted",
                )}
              >
                {counts[option.key]}
              </span>
            </Link>
          );
        })}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>
            {showing === 0
              ? "Nothing to show"
              : `${from + 1}-${from + showing} of ${total}`}
          </CardTitle>
        </CardHeader>

        <CardContent className="justify-start px-1.5 py-1.5">
          <LiveBoard rows={rows} mode={filter === "closed" ? "recent" : filter === "live" ? "live" : "mixed"} />
        </CardContent>
      </Card>

      {(hasPrev || hasNext) && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <PageLink href={href({ page: page - 1 })} enabled={hasPrev} direction="prev" />
          <span className="tabular font-mono text-2xs text-copy-muted">
            Page {page + 1} of {Math.max(1, Math.ceil(total / JOBS_PER_PAGE))}
          </span>
          <PageLink href={href({ page: page + 1 })} enabled={hasNext} direction="next" />
        </nav>
      )}
    </div>
  );
}

/**
 * A pager step.
 *
 * Rendered as a disabled `span` rather than a dimmed link at the ends. A link
 * that goes to page minus one is a link that lies, and keyboard users reach it
 * before they can see it is pointless.
 */
function PageLink({
  href,
  enabled,
  direction,
}: {
  href: string;
  enabled: boolean;
  direction: "prev" | "next";
}) {
  const label = direction === "prev" ? "Previous" : "Next";
  const Icon = direction === "prev" ? ArrowLeft : ArrowRight;

  const inner = (
    <>
      {direction === "prev" && <Icon className="size-4" aria-hidden />}
      {label}
      {direction === "next" && <Icon className="size-4" aria-hidden />}
    </>
  );

  const base =
    "inline-flex min-h-10 items-center gap-2 rounded-[0.75rem] border px-4 text-note font-semibold";

  if (!enabled) {
    return (
      <span className={cn(base, "border-hairline/60 text-copy-muted/50")} aria-disabled>
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        base,
        "border-hairline bg-white text-navy-900",
        "transition-colors duration-[var(--duration-fast)] hover:border-azure-300 hover:bg-azure-50",
      )}
    >
      {inner}
    </Link>
  );
}
