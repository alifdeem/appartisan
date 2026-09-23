import type { Metadata } from "next";
import { Phone } from "lucide-react";

import { AssignJob } from "@/app/(app)/admin/matching/_components/assign-job";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { formatPhoneForDisplay } from "@/lib/phone";
import { listAssignableProviders, listUnmatchedJobs } from "@/lib/jobs/matching";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Stalled jobs" };

/**
 * The jobs the matcher could not place.
 *
 * PLAN.md §6 lists an admin fallback as one of three mitigations for thin
 * supply and is blunt about it: "a human phones an artisan directly. Every real
 * marketplace runs on this for its first six months." So this is a designed
 * workflow, not an error log — the screen is built around making the phone call
 * and recording the outcome, in that order.
 *
 * Both numbers are tap-to-call: the client's, because the first thing to do is
 * usually to tell them what is happening, and each artisan's, because the
 * assignment is only real once somebody has said yes on the phone.
 *
 * Artisans who are offline or out of radius are shown deliberately. They are
 * exactly who this screen exists to reach — the matcher already tried everybody
 * it could see automatically.
 */
export default async function StalledJobsPage() {
  const jobs = await listUnmatchedJobs();

  // One query per job, but the queue is a handful of rows by construction — if
  // it is ever long enough for this to matter, the problem is supply, not SQL.
  const withCandidates = await Promise.all(
    jobs.map(async (job) => ({
      job,
      candidates: job.category_id ? await listAssignableProviders(job.category_id) : [],
    })),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-navy-900">Stalled jobs</h1>
          <p className="max-w-prose text-[0.9375rem] leading-relaxed text-copy-muted">
            Nobody nearby was free, or the client declined too many prices. Call an artisan who
            can take it, then assign it here. The job carries on exactly as if they had accepted
            the offer themselves.
          </p>
        </div>
      </div>

      {withCandidates.length === 0 ? (
        <div className="rounded-card border border-dashed border-hairline bg-canvas px-5 py-14 text-center">
          <p className="text-sm font-medium text-navy-900">Nothing is stuck</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-copy-muted">
            Every posted job either has an artisan or is still being matched.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {withCandidates.map(({ job, candidates }) => (
            <li key={job.id}>
              <Card>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-start gap-3.5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-field bg-azure-50 text-copy-muted">
                      <CategoryIcon name={job.category?.icon ?? "wrench"} className="size-5" />
                    </span>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-navy-900">
                          {job.category?.name ?? "Job"}
                        </h2>
                        <Badge tone="warning">
                          {job.status === "unmatched" ? "Needs an artisan" : "Expired"}
                        </Badge>
                        {(job.quote_rejections ?? 0) > 0 && (
                          <Badge tone="neutral">
                            {job.quote_rejections} price{job.quote_rejections === 1 ? "" : "s"}{" "}
                            declined
                          </Badge>
                        )}
                      </div>

                      <p className="tabular font-mono text-xs text-copy-muted">
                        {job.reference} · posted {timeAgo(job.created_at)}
                      </p>

                      {job.landmark && (
                        <p className="text-sm text-copy">{job.landmark}</p>
                      )}
                      {job.description && (
                        <p className="max-w-prose text-sm leading-relaxed text-copy-muted">
                          {job.description}
                        </p>
                      )}
                    </div>

                    {job.client?.phone && (
                      <a
                        href={`tel:${job.client.phone}`}
                        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-field border border-hairline bg-white px-3.5 text-sm font-medium text-navy-900 shadow-xs transition-[background-color,border-color,transform] duration-[var(--duration-instant)] ease-out-strong hover:border-copy-muted hover:bg-canvas active:scale-[0.98]"
                      >
                        <Phone className="size-4" aria-hidden />
                        <span className="tabular font-mono">
                          {formatPhoneForDisplay(job.client.phone)}
                        </span>
                      </a>
                    )}
                  </div>

                  <AssignJob jobId={job.id} candidates={candidates} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
