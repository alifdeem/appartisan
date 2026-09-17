import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { CategoryIcon } from "@/components/marketplace/category-icon";
import { cn } from "@/lib/utils";

import { AvailabilityToggle } from "@/components/provider/availability-toggle";
import { Badge } from "@/components/ui/badge";
import { IncomingOffer } from "@/components/provider/incoming-offer";
import { getLiveOffer, listProviderJobs } from "@/lib/jobs/matching";
import { jobStatus } from "@/lib/jobs/status";
import { Card, CardContent } from "@/components/ui/card";
import { RoadmapPanel } from "@/components/app/roadmap-panel";
import { Stat } from "@/components/app/stat";
import { ReliabilityPanel } from "@/components/provider/reliability-panel";
import { VerificationPanel } from "@/components/provider/verification-panel";
import { formatCedis } from "@/lib/money";
import {
  getMyProvider,
  getMyReliability,
  listProviderCategories,
  listProviderDocuments,
  listVerificationReviews,
} from "@/lib/providers/queries";
import { getCurrentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My work" };

/**
 * The artisan's home.
 *
 * Ordered by what the person came here to do. For an approved artisan that is
 * one thing — go online — so the toggle is the first object on the screen and
 * verification drops to a quiet confirmation below it. For everybody else the
 * toggle is inert, so verification comes first and the toggle sits underneath
 * as the thing being worked towards.
 *
 * The same two components in a different order, decided by state. It is worth
 * doing because the two audiences never overlap: an artisan is unverified once
 * and approved for the rest of their time on the platform.
 */
export default async function ProviderDashboard({
  searchParams,
}: PageProps<"/provider">) {
  const [profile, provider, params] = await Promise.all([
    getCurrentProfile(),
    getMyProvider(),
    searchParams,
  ]);

  if (!profile) redirect("/login");

  // An admin or client that reached /provider without a provider row. The proxy
  // normally prevents this; a Server Component must never assume it ran.
  if (!provider) redirect("/");

  const [trades, documents, reviews, liveOffer, jobs, reliability] = await Promise.all([
    listProviderCategories(provider.profile_id),
    listProviderDocuments(provider.profile_id),
    listVerificationReviews(provider.profile_id),
    getLiveOffer(),
    listProviderJobs(),
    getMyReliability(),
  ]);

  const status = provider.verification_status;
  const approved = status === "approved";

  // Work in hand, newest first. Everything past `paid` is history and belongs
  // in an earnings screen rather than on top of today's job.
  const activeJobs = jobs.filter((job) => jobStatus(job.status).group === "active");
  const firstName = profile.full_name.split(" ")[0];
  const justSubmitted = params.submitted === "1" && status === "pending";

  const verification = (
    <VerificationPanel
      provider={provider}
      tradeCount={trades.length}
      docTypes={documents.map((doc) => doc.doc_type)}
      latestReview={reviews[0] ?? null}
    />
  );

  const availability = (
    <AvailabilityToggle
      availability={provider.availability}
      canGoOnline={approved}
      blockedReason={
        status === "pending"
          ? "You can go online once our team has approved you."
          : status === "suspended"
            ? "Your account is suspended, so you will not receive offers."
            : "Finish getting verified to start receiving jobs."
      }
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ink-900">Hello, {firstName}</h1>
          <p className="text-[0.9375rem] text-ink-600">
            {approved
              ? provider.availability === "online"
                ? "You're visible to clients near you."
                : "You're not receiving jobs right now."
              : "Your work, your earnings, and your verification."}
          </p>
        </div>

        {trades.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {trades.slice(0, 3).map((trade) => (
              <Badge key={trade.id} tone="neutral">
                {trade.name}
              </Badge>
            ))}
            {trades.length > 3 && <Badge tone="neutral">+{trades.length - 3}</Badge>}
          </div>
        )}
      </div>

      {/* Shown once, on the redirect that follows submitting. Not a toast: the
          artisan has just navigated, and a message that disappears after four
          seconds is the wrong medium for "we have your application". */}
      {justSubmitted && (
        <div className="animate-fade-up flex items-start gap-3 rounded-card border border-success-500/35 bg-success-50 px-4 py-3.5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-700" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-success-700">Application sent</p>
            <p className="text-sm leading-relaxed text-ink-700">
              Our team will review your documents and call you on{" "}
              <span className="tabular font-mono">{profile.phone}</span>. You will see the result
              on this screen.
            </p>
          </div>
        </div>
      )}

      {/* Above everything, including the availability toggle. An offer has a
          clock on it; nothing else on this screen does. */}
      <IncomingOffer
        offer={
          liveOffer && liveOffer.job
            ? {
                id: liveOffer.id,
                expiresAt: liveOffer.expires_at,
                sentAt: liveOffer.sent_at,
                distanceKm:
                  liveOffer.distance_km === null ? null : Number(liveOffer.distance_km),
                categoryName: liveOffer.job.category?.name ?? "Job",
                categoryIcon: liveOffer.job.category?.icon ?? "wrench",
                landmark: liveOffer.job.landmark,
              }
            : null
        }
        listening={approved && provider.availability === "online"}
      />

      {approved ? (
        <>
          {availability}
          {verification}
        </>
      ) : (
        <>
          {verification}
          {availability}
        </>
      )}

      {/* Only once they are approved: an artisan still waiting on their Ghana
          Card review has no offers to have a reliability record about, and a
          panel full of dashes reads as a problem with them. */}
      {approved && reliability && <ReliabilityPanel stats={reliability} />}

      {activeJobs.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-ink-800">Your work</h2>
          <ul className="space-y-2.5">
            {activeJobs.map((job) => {
              const presentation = jobStatus(job.status);
              const needsPrice = job.status === "quote_pending";

              return (
                <li key={job.id}>
                  <Link
                    href={`/provider/jobs/${job.id}`}
                    className={cn(
                      "group flex items-center gap-3.5 rounded-card border bg-ink-0 px-4 py-3.5 shadow-sm",
                      "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-out-strong",
                      // The one that needs something from the artisan right now
                      // is marked. The rest are simply in flight.
                      needsPrice
                        ? "border-warning-500/40 hover:border-warning-500/60"
                        : "border-ink-200 hover:border-ink-300",
                      "hover:shadow-md",
                    )}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-field bg-ink-100 text-ink-600">
                      <CategoryIcon name={job.category?.icon ?? "wrench"} className="size-5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-medium text-ink-900">
                        {job.category?.name ?? "Job"}
                      </span>
                      <span className="block truncate text-sm text-ink-600">
                        {needsPrice ? "Send your price" : presentation.label}
                        {job.landmark && <span className="text-ink-400"> · {job.landmark}</span>}
                      </span>
                    </span>

                    <Badge tone={needsPrice ? "warning" : presentation.tone}>
                      {presentation.label}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Jobs completed" value={String(provider.jobs_completed)} />
        <Stat
          label="Rating"
          value={provider.rating_count > 0 ? Number(provider.rating_avg).toFixed(1) : "—"}
          note={provider.rating_count ? `${provider.rating_count} ratings` : "No ratings yet"}
        />
        <Stat label="Paid out" value={formatCedis(0)} note="Lifetime earnings" />
      </div>

      {/* The full history, not just the latest. An artisan who was rejected,
          fixed it and was approved should be able to see that sequence — it is
          the only record of what they were asked to change. */}
      {reviews.length > 1 && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-sm font-semibold text-ink-800">Your verification history</h2>
            <ol className="space-y-2.5">
              {reviews.map((review) => (
                <li key={review.id} className="flex items-baseline gap-3 text-sm">
                  <Badge
                    tone={
                      review.decision === "approved"
                        ? "success"
                        : review.decision === "suspended"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {review.decision}
                  </Badge>
                  <span className="min-w-0 flex-1 text-ink-700">
                    {review.call_notes ?? <span className="text-ink-400">No notes recorded.</span>}
                  </span>
                  <time className="shrink-0 text-xs text-ink-500">
                    {new Date(review.reviewed_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </time>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <RoadmapPanel
        title="What's coming to this screen"
        description="Verification is live. These land on the same screen as the later phases ship."
        items={[
          { label: "Receive job offers with a countdown", phase: "Phase 3" },
          { label: "Build and send an itemised quote", phase: "Phase 3" },
          { label: "Track earnings and payout history", phase: "Phase 4" },
          { label: "Navigate to the job and share live location", phase: "Phase 5" },
          { label: "See your reliability score", phase: "Phase 6" },
        ]}
      />
    </div>
  );
}
