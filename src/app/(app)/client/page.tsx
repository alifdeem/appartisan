import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { LiveJobCard } from "@/components/jobs/live-job-card";
import { HomeHero } from "@/components/mobile/home-hero";
import { JobCard } from "@/components/jobs/job-card";
import { SearchPill } from "@/components/mobile/search-pill";
import { SegmentedSection, type Segment } from "@/components/mobile/segmented-section";
import { StartDraftForm } from "@/components/mobile/start-draft";
import { ServiceCards, ServiceGrid } from "@/components/mobile/service-cards";
import { buttonVariants } from "@/components/ui/button-variants";
import { FEATURED_SLUGS, categoryPhotoMap } from "@/lib/images";
import {
  countPhotosByJob,
  getJobProvider,
  listActiveCategories,
  listClientJobs,
} from "@/lib/jobs/queries";
import type { JobWithCategory } from "@/lib/jobs/queries";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { isLiveJob, jobStatus } from "@/lib/jobs/status";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

/**
 * The client's home, rebuilt against `designing-ui-ux/home.png`.
 *
 * **The order, and who chose it.** Hero → search → categories → featured
 * trades → *your jobs* → explore everything. Your jobs sits exactly where the
 * reference puts its "Get 40% Off" promo row, which is where this screen was
 * asked to put it.
 *
 * That is a deliberate move away from what this screen did before, and worth
 * stating plainly: previously live jobs came first, on the argument that a
 * client with a plumber on the way opens the app to see where the plumber is.
 * That argument has not gone away — it is now carried by the bell in the hero
 * instead, which counts jobs in flight and links straight to them, so the
 * urgent case is answered in the first 60px of the screen without displacing
 * the browse-first layout.
 *
 * **Sections of the reference that are not here, and why.** Each one is a
 * feature the product does not have rather than a design choice:
 *
 *   • **The smart-filter row** ("Within 5 km", "5+ Years", "Available today").
 *     Excluded by request, and it could not have been honest anyway: artisans
 *     are matched to a job by the matcher, not browsed and filtered by hand
 *     (PLAN.md §14).
 *   • **Promo cards.** §14 puts promo codes out of v1. That slot carries the
 *     client's real jobs instead.
 *   • **Prices and ratings on service cards.** §9 — artisans price each job
 *     after seeing it; any figure here is invented. Ratings attach to artisans,
 *     not to trades. See the note in `service-cards.tsx`.
 *   • **Four of the six "Explore" tabs.** Popular / Near you / Top rated /
 *     Offers all need data nothing collects. The segmented control itself is
 *     built and shipped — see `segmented-section.tsx` — and fed the segments
 *     that are real.
 */
export default async function ClientHome() {
  const [profile, jobs, categories] = await Promise.all([
    getCurrentProfile(),
    listClientJobs(),
    listActiveCategories(),
  ]);

  const photoCounts = await countPhotosByJob(jobs.map((job) => job.id));

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("default_address")
    .eq("profile_id", profile?.id ?? "")
    .maybeSingle();

  const drafts = jobs.filter((job) => job.status === "draft");
  const active = jobs.filter((job) => jobStatus(job.status).group === "active");

  /**
   * The one job worth the top of the screen.
   *
   * `listClientJobs` is newest-first, so this is the most recent live job. A
   * client with two running at once still only gets one card — the rest are a
   * tap away in Your jobs, and two hero cards is no hero at all.
   */
  const liveJob = active.find((job) => isLiveJob(job.status)) ?? null;
  const liveProvider = liveJob ? await getJobProvider(liveJob.provider_id) : null;

  // Everything the client has on right now, drafts last: an unfinished draft is
  // less urgent than an artisan who is on the way.
  const inFlight = [...active, ...drafts];
  const firstName = profile?.full_name.split(" ")[0] ?? "there";

  // The featured row, in the order `FEATURED_SLUGS` lists rather than the order
  // the database returns — the list is the editorial decision, and sorting by
  // `sort_order` would quietly override it.
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const featured = FEATURED_SLUGS.map((slug) => bySlug.get(slug)).filter((c) => c !== undefined);

  /**
   * Trades this client has booked before, newest first.
   *
   * The one genuinely personal cut of the category list available today, and it
   * costs nothing extra: `listClientJobs` has already been awaited above, and
   * every job carries its category. No new query, no new column.
   */
  const usedSlugs = [...new Set(jobs.map((job) => job.category?.slug).filter((s) => s !== undefined))];
  const usedBefore = usedSlugs.map((slug) => bySlug.get(slug)).filter((c) => c !== undefined);

  // Both panels live in one form, so the pending state is shared and switching
  // tabs mid-submit cannot strand a spinner in a hidden panel.
  const segments: Segment[] = [
    { id: "all", label: "All services", content: <ServiceGrid categories={categories} /> },
    ...(usedBefore.length > 0
      ? [
          {
            id: "used",
            label: "You've used before",
            content: <ServiceGrid categories={usedBefore} />,
          },
        ]
      : []),
  ];

  return (
    // pb-28 clears the fixed tab bar. The bar is out of flow, so it cannot
    // reserve its own space — every screen under it owns that padding.
    <div className="pb-28">
      <HomeHero
        greeting={`Welcome back, ${firstName}`}
        subtitle="Choose how you’d like to get help:"
        address={client?.default_address}
        activeCount={active.length}
      />

      <div className="mt-5 space-y-7">
        <SearchPill />

        {/**
         * The slot that used to hold the category chips.
         *
         * A cascade, most useful first: a job happening right now, then an
         * unfinished draft, then **nothing at all**. Collapsing is deliberate —
         * the two sections below already answer "what might I start" twice
         * over, and a third prompt in the same scroll is noise. A client with
         * no history then reads search → popular → explore, which is the
         * browse-first shape they actually need.
         */}
        {liveJob ? (
          <LiveJobCard
            href={`/client/jobs/${liveJob.id}`}
            eyebrow={jobStatus(liveJob.status).label}
            title={liveJob.category?.name ?? "Your job"}
            subtitle={liveJob.landmark}
            status={liveJob.status}
            person={
              liveProvider && {
                name: liveProvider.fullName,
                trade: liveJob.category?.name ?? "Artisan",
                ratingAvg: liveProvider.ratingAvg,
                ratingCount: liveProvider.ratingCount,
                jobsCompleted: liveProvider.jobsCompleted,
              }
            }
            action={liveProvider ? null : jobStatus(liveJob.status).blurb}
          />
        ) : (
          drafts.length > 0 && <DraftResume job={drafts[0]} />
        )}

        {featured.length > 0 && (
          <Section
            title="Popular right now"
            action={
              <Link
                href="/client/post"
                className="tap inline-flex items-center gap-1 text-note font-semibold text-azure-600 underline-offset-4 hover:underline"
              >
                All categories
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            <StartDraftForm>
              <ServiceCards categories={featured} photos={categoryPhotoMap(FEATURED_SLUGS)} />
            </StartDraftForm>
          </Section>
        )}

        {inFlight.length > 0 && (
          <Section
            title="Your jobs"
            action={
              <Link
                href="/client/jobs"
                className="tap text-note font-semibold text-azure-600 underline-offset-4 hover:underline"
              >
                All jobs
              </Link>
            }
          >
            <ul className="space-y-2.5">
              {inFlight.slice(0, 3).map((job) => (
                <li key={job.id}>
                  <JobCard job={job} photoCount={photoCounts[job.id] ?? 0} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Explore our services">
          <StartDraftForm>
            <SegmentedSection segments={segments} label="Explore services" />
          </StartDraftForm>
        </Section>

        <section className="rounded-[1.5rem] bg-azure-50 p-6 text-center">
          <h2 className="font-space text-title-sm font-bold text-balance text-navy-900">
            Can&rsquo;t find what you need?
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-note leading-relaxed text-copy-muted">
            Describe the problem in your own words and we&rsquo;ll match you to someone who does it.
          </p>
          <Link
            href="/client/post"
            className={cn(
              buttonVariants({ variant: "navy", size: "lg", shape: "pill" }),
              "mt-5",
            )}
          >
            <Plus />
            Post a job
          </Link>
        </section>

        {inFlight.length === 0 && jobs.length > 0 && (
          <Link
            href="/client/jobs"
            className="flex min-h-13 items-center gap-2 rounded-[1.25rem] border border-hairline bg-white px-5 text-ui font-medium text-navy-900 transition-colors duration-[var(--duration-fast)] hover:border-azure-300"
          >
            Past jobs
            <ArrowRight className="ml-auto size-4 shrink-0 text-azure-500" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * An unfinished draft, offered back.
 *
 * Second in the cascade, below a live job and above nothing. Somebody who got
 * halfway through describing a problem and was interrupted is the one case
 * where a prompt at the top of the screen is genuinely useful rather than
 * another thing shouting "start something" — they already did.
 *
 * Quiet on purpose: dashed, tinted, no shadow. A draft is not an event, and
 * dressing it like the live card would make an abandoned form compete with an
 * artisan who is on the way.
 */
function DraftResume({ job }: { job: JobWithCategory }) {
  return (
    <Link
      href={`/client/post/${job.id}/describe`}
      className={cn(
        "flex items-center gap-3.5 rounded-[1.25rem] border border-dashed border-hairline bg-azure-50/50 p-4",
        "transition-colors duration-[var(--duration-fast)] hover:border-azure-300 hover:bg-azure-50",
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-[0.875rem] bg-white text-navy-800">
        <CategoryIcon name={job.category?.icon ?? "wrench"} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-note font-bold text-navy-900">
          Finish your {job.category?.name.toLowerCase() ?? "job"} request
        </span>
        <span className="mt-0.5 block truncate text-2xs text-copy-muted">
          Started {timeAgo(job.created_at)} · not posted yet
        </span>
      </span>

      <ArrowRight className="size-4 shrink-0 text-azure-500" aria-hidden />
    </Link>
  );
}

/**
 * A titled block. Every section on this screen has the same heading rhythm, and
 * one component is what keeps the gap under the title from drifting by two
 * pixels between them — which is the difference this screen's whole design
 * depends on.
 */
function Section({
  title,
  action,
  children,
}: {
  title: string;
  /** Optional right-aligned link on the heading row. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <h2 className="font-space text-lede font-bold text-navy-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
