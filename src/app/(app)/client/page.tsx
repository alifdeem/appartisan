import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Plus, Search } from "lucide-react";

import { CategoryChips } from "@/components/mobile/category-chips";
import { JobCard } from "@/components/jobs/job-card";
import { buttonVariants } from "@/components/ui/button-variants";
import { countPhotosByJob, listActiveCategories, listClientJobs } from "@/lib/jobs/queries";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { jobStatus } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

/**
 * The client's home (`@4-home` in the reference).
 *
 * The reference is a browse-first marketplace: search, categories, offers, a
 * carousel of pros. That shape assumes every visit starts a new purchase. This
 * product is not that — a client with a plumber currently on the way opens the
 * app to see where the plumber is, and burying that under a category carousel
 * would be following a layout off a cliff.
 *
 * So the order is: **what is already happening, then what you might start.**
 * Live jobs first when there are any, browse first when there are none. The
 * reference's furniture is all here; it is sequenced by what the person came
 * for rather than by what a marketplace would like them to do.
 *
 * Four things from the reference are deliberately absent, each because the
 * product does not have the thing behind them:
 *
 *   • **Discount cards.** PLAN.md §14 puts promo codes out of v1. A "Get 40%
 *     Off" tile with nothing behind it is a lie on the first screen.
 *   • **Per-hour prices on category cards.** §9: artisans price each job
 *     freely and there is no price guidance in v1, so any figure here would be
 *     invented.
 *   • **A carousel of top-rated pros.** §14 excludes public artisan browsing.
 *     Artisans are matched to a job, not shopped for.
 *   • **A chat tab.** §14 excludes in-app messaging.
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

  // Everything the client has on right now, drafts last: an unfinished draft is
  // less urgent than an artisan who is on the way.
  const inFlight = [...active, ...drafts];
  const firstName = profile?.full_name.split(" ")[0] ?? "there";

  return (
    // pb-28 clears the fixed tab bar. The bar is out of flow, so it cannot
    // reserve its own space — every screen under it owns that padding.
    <div className="space-y-7 pb-28">
      <header className="space-y-2">
        <h1 className="text-title font-semibold text-ink-900">Hello, {firstName}</h1>
        <p className="text-ui text-ink-600">
          {inFlight.length > 0
            ? "Here's what you have on."
            : "What needs doing? We'll find a verified artisan near you."}
        </p>

        {client?.default_address && (
          <p className="flex items-center gap-1.5 text-note text-ink-500">
            <MapPin className="size-3.5 shrink-0 text-brand-700" aria-hidden />
            <span className="truncate">{client.default_address}</span>
          </p>
        )}
      </header>

      {/* Not a search input: there is nothing to search yet beyond 26
          categories, and a box that only filters a list the user is about to
          see anyway is a control that costs a tap and returns nothing. It is
          a link to the picker, wearing a search bar's clothes because that is
          where a thumb goes looking. */}
      <Link
        href="/client/post"
        className="flex min-h-12 items-center gap-2.5 rounded-full border border-ink-200 bg-surface-sunken px-4 text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-700"
      >
        <Search className="size-4.5 shrink-0" aria-hidden />
        <span className="text-ui">What do you need doing?</span>
      </Link>

      {inFlight.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lede font-semibold text-ink-900">Your jobs</h2>
            <Link
              href="/client/jobs"
              className="tap text-sm text-ink-500 underline-offset-4 transition-colors hover:text-ink-900 hover:underline"
            >
              All jobs
            </Link>
            </div>

            <ul className="space-y-2.5">
              {inFlight.slice(0, 3).map((job) => (
                <li key={job.id}>
                  <JobCard job={job} photoCount={photoCounts[job.id] ?? 0} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lede font-semibold text-ink-900">Browse by category</h2>
          <CategoryChips categories={categories} />
        </section>

        <section className="rounded-card border border-ink-200 bg-surface-sunken p-5 text-center">
          <h2 className="text-title-sm font-semibold text-balance text-ink-900">
            Can&rsquo;t find what you need?
          </h2>
          <p className="mx-auto mt-1.5 max-w-xs text-ui text-ink-600">
            Describe the problem in your own words and we&rsquo;ll match you to someone who does it.
          </p>
          <Link
            href="/client/post"
            className={cn(buttonVariants({ size: "lg", shape: "pill" }), "mt-4")}
          >
            <Plus />
            Post a job
          </Link>
        </section>

        {inFlight.length === 0 && jobs.length > 0 && (
          <Link
            href="/client/jobs"
            className="flex min-h-12 items-center gap-2 rounded-card border border-ink-200 bg-white px-4 text-ui text-ink-700 transition-colors hover:border-ink-300"
          >
            Past jobs
            <ArrowRight className="ml-auto size-4 shrink-0 text-ink-400" aria-hidden />
          </Link>
        )}
    </div>
  );
}
