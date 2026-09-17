import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { JobCard } from "@/components/jobs/job-card";
import { RoadmapPanel } from "@/components/app/roadmap-panel";
import { Stat } from "@/components/app/stat";
import { countPhotosByJob, listClientJobs, summariseJobs } from "@/lib/jobs/queries";
import { jobStatus } from "@/lib/jobs/status";
import { getCurrentProfile } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My jobs" };

/**
 * The client's home.
 *
 * Ordered by what the person is most likely to have come here to do: finish
 * something they started, check on something in flight, or start something new.
 * Completed work is a link, not a list — nobody opens this screen to admire a
 * tap that was fixed in March.
 */
export default async function ClientDashboard() {
  const [profile, jobs] = await Promise.all([getCurrentProfile(), listClientJobs()]);

  const photoCounts = await countPhotosByJob(jobs.map((job) => job.id));
  const summary = summariseJobs(jobs);

  const drafts = jobs.filter((job) => job.status === "draft");
  const active = jobs.filter((job) => jobStatus(job.status).group === "active");
  const closed = jobs.filter((job) => jobStatus(job.status).group === "closed");

  const firstName = profile?.full_name.split(" ")[0] ?? "there";
  const empty = jobs.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ink-900">Hello, {firstName}</h1>
          <p className="text-[0.9375rem] text-ink-600">
            {empty
              ? "Tell us what needs fixing and we'll find a verified artisan near you."
              : active.length > 0
                ? `${active.length} job${active.length === 1 ? "" : "s"} in progress.`
                : "Nothing in progress right now."}
          </p>
        </div>

        {/* A Link, wearing the button's clothes. `Button` renders a real
            <button>, and an anchor inside one is invalid markup that swallows
            the navigation — so the variants are applied to the Link directly. */}
        <Link href="/client/post" className={cn(buttonVariants({ size: "lg" }), "shrink-0")}>
          <Plus />
          Book a service
        </Link>
      </div>

      {empty ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="In progress" value={String(summary.active)} />
            <Stat label="Drafts" value={String(summary.drafts)} />
            <Stat label="Completed" value={String(summary.completed)} />
          </div>

          {drafts.length > 0 && (
            <Section
              title="Pick up where you left off"
              description="These are not posted yet, so no artisan has seen them."
            >
              {drafts.map((job) => (
                <JobCard key={job.id} job={job} photoCount={photoCounts[job.id] ?? 0} />
              ))}
            </Section>
          )}

          {active.length > 0 && (
            <Section title="In progress">
              {active.map((job) => (
                <JobCard key={job.id} job={job} photoCount={photoCounts[job.id] ?? 0} />
              ))}
            </Section>
          )}

          {closed.length > 0 && (
            <Link
              href="/client/jobs"
              className="group flex items-center justify-between gap-3 rounded-card border border-ink-200 bg-ink-0 px-4 py-3.5 shadow-sm transition-colors hover:border-ink-300"
            >
              <span className="text-sm text-ink-700">
                <span className="tabular font-mono font-medium text-ink-900">{closed.length}</span>{" "}
                past job{closed.length === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                View history
                <ArrowRight
                  className="size-4 transition-transform duration-[var(--duration-fast)] ease-out-strong group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          )}
        </>
      )}

      <RoadmapPanel
        title="What's still to come"
        description="Booking, paying, tracking, sign-off and rating all work. What is left is making the money and the messages real."
        items={[
          { label: "Real mobile money — payments are simulated today", phase: "Phase 8" },
          { label: "SMS updates as your job moves", phase: "Phase 8" },
          { label: "Terms and privacy policy", phase: "Phase 7" },
        ]}
      />
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold text-ink-800">{title}</h2>
        {description && <p className="text-sm text-ink-500">{description}</p>}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="space-y-4 py-10 text-center">
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-ink-900">No jobs yet</p>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-ink-600">
            Describe the problem, we find the nearest verified artisan, and you approve their
            price before anyone travels. Posting costs nothing.
          </p>
        </div>

        <Link href="/client/post" className={cn(buttonVariants({ size: "lg" }), "mx-auto")}>
          <Plus />
          Book your first service
        </Link>
      </CardContent>
    </Card>
  );
}
