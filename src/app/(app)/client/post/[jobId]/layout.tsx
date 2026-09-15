import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CategoryIcon } from "@/components/marketplace/category-icon";
import { DiscardDraft } from "@/app/(app)/client/post/[jobId]/_components/discard-draft";
import { PostSteps } from "@/app/(app)/client/post/[jobId]/_components/post-steps";
import { getClientJob } from "@/lib/jobs/queries";

/**
 * The shell around the three posting steps.
 *
 * Loading the job here rather than in each step means ownership is checked once
 * on every route underneath — a step page cannot forget. RLS already scopes the
 * read to the caller, so a job belonging to somebody else is indistinguishable
 * from one that does not exist, which is the right answer to give either way.
 *
 * A draft that has already been posted falls through to `notFound()` rather
 * than redirecting to the job. Posting is the one irreversible step in this
 * flow, and silently bouncing someone who used the back button into a live job
 * screen makes it look as though their edit went through.
 */
export default async function PostJobLayout({
  children,
  params,
}: LayoutProps<"/client/post/[jobId]">) {
  const { jobId } = await params;
  const job = await getClientJob(jobId);

  if (!job || job.status !== "draft") notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link
          href="/client/post"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Change service
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-field bg-brand-50 text-brand-700">
            <CategoryIcon name={job.category?.icon ?? "wrench"} />
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-ink-900">
              {job.category?.name ?? "New request"}
            </h1>
            <p className="text-sm text-ink-500">Draft — not posted yet</p>
          </div>

          <DiscardDraft jobId={job.id} />
        </div>

        <PostSteps />
      </div>

      {children}
    </div>
  );
}
