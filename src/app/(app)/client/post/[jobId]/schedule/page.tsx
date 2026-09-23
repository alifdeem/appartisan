import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ScheduleForm } from "@/app/(app)/client/post/[jobId]/schedule/_components/schedule-form";
import { getClientJob } from "@/lib/jobs/queries";
import { isPreferredWindow } from "@/lib/jobs/schedule";

export const metadata: Metadata = { title: "When suits you?" };

export default async function ScheduleStepPage({
  params,
}: PageProps<"/client/post/[jobId]/schedule">) {
  const { jobId } = await params;

  // The layout has already established that this is the caller's draft. Read it
  // again rather than passing it down: a Server Component is its own request,
  // and a page that trusts its layout to have checked is a page that stops
  // being safe the moment someone renders it from somewhere else.
  const job = await getClientJob(jobId);
  if (!job || job.status !== "draft") notFound();

  return (
    <ScheduleForm
      jobId={job.id}
      initialDate={job.preferred_date ?? null}
      // The column is a plain `text` with a check constraint, so it arrives as
      // `string | null` and is narrowed here rather than cast — a value that
      // predates the constraint, or survives a future one being relaxed, then
      // falls back to "any time" instead of selecting a window that does not
      // exist.
      initialWindow={isPreferredWindow(job.preferred_window) ? job.preferred_window : null}
    />
  );
}
