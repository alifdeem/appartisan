import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
 *
 * **The trade lives on the form, not here.** The reference (`@1-main`) puts a
 * scrollable row of trades directly above the description with the chosen one
 * filled, so changing your mind is one tap. That row is `TradeSwitcher`, and
 * repeating the trade in this bar as well would name it twice on one screen.
 */
export default async function PostJobLayout({
  children,
  params,
}: LayoutProps<"/client/post/[jobId]">) {
  const { jobId } = await params;
  const job = await getClientJob(jobId);

  if (!job || job.status !== "draft") notFound();

  return (
    // pb-32 clears the pinned action every step renders. The tab bar hides
    // itself inside this flow — see `bottom-nav.tsx`.
    <div className="pb-32">
      <header className="-mx-5 -mt-6 mb-6 border-b border-hairline bg-canvas px-5 pt-3 pb-5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/client"
            aria-label="Leave and go home"
            className="-ml-2 grid size-11 place-items-center rounded-full text-navy-900 transition-colors duration-[var(--duration-instant)] hover:bg-white active:bg-azure-50"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>

          <p className="text-note font-semibold text-navy-900">Post a job</p>

          <DiscardDraft jobId={job.id} />
        </div>

        <div className="mt-4">
          <PostSteps />
        </div>
      </header>

      {children}
    </div>
  );
}
