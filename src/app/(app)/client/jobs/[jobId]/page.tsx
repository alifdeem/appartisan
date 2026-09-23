import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, FileText, MapPin, Mic, Phone } from "lucide-react";

import { CancelJob } from "@/components/jobs/cancel-job";
import { CounterpartyCard } from "@/components/jobs/counterparty-card";
import { DetailPanel, DetailSection, JobDetailHeader } from "@/components/jobs/job-detail-chrome";
import { JobStatusHero } from "@/components/jobs/job-status-hero";
import { JobTimeline } from "@/components/jobs/job-timeline";
import { LocationMap } from "@/components/jobs/location-map";
import { MatchingProgress } from "@/components/jobs/matching-progress";
import { MomoPayPanel } from "@/components/jobs/momo-pay-panel";
import { PaymentReceipt } from "@/components/jobs/payment-receipt";
import { PhotoGrid } from "@/components/jobs/photo-grid";
import { PostedBanner } from "@/components/jobs/posted-banner";
import { QuoteReview } from "@/components/jobs/quote-review";
import { RefreshOnReturn } from "@/components/jobs/refresh-on-return";
import { RaiseDispute } from "@/components/jobs/raise-dispute";
import { RateJob } from "@/components/jobs/rate-job";
import { SignOff } from "@/components/jobs/sign-off";
import { getBalanceDue, getDepositDue, legState, listJobPayments } from "@/lib/payments/queries";
import { detectMomoNetwork } from "@/lib/phone";
import { getCurrentProfile } from "@/lib/supabase/server";
import { getLatestQuote, getMatchingProgress } from "@/lib/jobs/matching";
import { isCancellable, jobStatus } from "@/lib/jobs/status";
import {
  getClientJob,
  getJobCounterparty,
  getJobDispute,
  getJobProvider,
  getJobRating,
  listJobEvents,
  listJobPhotos,
  signJobPhotos,
  signVoiceNote,
} from "@/lib/jobs/queries";
import { INVOICEABLE_STATUSES, invoiceNumber } from "@/lib/jobs/invoice";
import { scheduleSummary } from "@/lib/jobs/schedule";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Your job" };

/** Mirrors `matching_radius_passes` in settings. Display only. */
const PASS_COUNT = 3;

/**
 * The one screen that changes with state (PLAN.md §11).
 *
 * Every phase of a job hangs off this route rather than getting a screen of its
 * own — the quote, the deposit, the tracking, the sign-off, the receipt. A
 * client should have one place to look at a job, not six.
 *
 * **The order, and the one rule behind it.** *What is happening → what you must
 * do → what you asked for → what happened.* Reading down the screen answers the
 * questions in the order somebody actually has them, and the second band is
 * empty most of the time, which is exactly right: a job that needs nothing from
 * the client should not invent something for them to look at.
 *
 * Three things this rebuild fixed that were not about colour:
 *
 *  • **The layout was a two-column grid that has never rendered.** It asked for
 *    `lg:grid-cols-[1.4fr_1fr]` inside a `max-w-[26rem]` phone shell, so the
 *    sidebar has always stacked. Two columns of code producing one column of
 *    output, with the running order decided by which `<div>` a panel happened
 *    to be in rather than by what the reader needed next.
 *
 *  • **Nobody was named.** `provider_public` and the counterparty policy in
 *    `0003_rls.sql` both existed and neither was read, so the screen never said
 *    who was coming to the house, and never offered their number. See
 *    `CounterpartyCard` — in a market with no in-app messaging and no live
 *    tracking, the phone call *is* the tracking.
 *
 *  • **The artisan's completion photographs were filed under "What you told
 *    us".** They are the evidence a client signs off on, mixed in with the
 *    client's own pictures of the original problem. They are separated now, and
 *    the finished-work set sits directly above the sign-off form.
 */
export default async function JobDetailPage({
  params,
  searchParams,
}: PageProps<"/client/jobs/[jobId]">) {
  const { jobId } = await params;

  // `postJobAction` has always redirected here with `?posted=1`. Until now
  // nothing read it, so the last step of posting a job was a screen that looked
  // identical to opening an old one.
  const justPosted = (await searchParams).posted === "1";

  const job = await getClientJob(jobId);
  if (!job) notFound();

  // A draft has no job screen — it has the posting flow it was abandoned in.
  if (job.status === "draft") notFound();

  const photoRows = await listJobPhotos(jobId);
  const [photos, voiceNoteUrl, events, progress, quote] = await Promise.all([
    signJobPhotos(photoRows),
    signVoiceNote(job.voice_note_path),
    listJobEvents(jobId),
    getMatchingProgress(jobId),
    getLatestQuote(jobId),
  ]);

  const [payments, profile, provider, contact] = await Promise.all([
    listJobPayments(jobId),
    getCurrentProfile(),
    getJobProvider(job.provider_id),
    getJobCounterparty(job.provider_id),
  ]);

  // Only fetched once the job is finished — a rating and a dispute are both
  // meaningless before then, and this screen is already doing plenty of reads.
  const isFinished = ["paid", "closed"].includes(job.status);
  const [rating, dispute] = isFinished
    ? await Promise.all([getJobRating(jobId), getJobDispute(jobId)])
    : [null, null];
  const deposit = legState(payments, "deposit");

  // Only asked for when it is actually owed — the RPC raises if no quote has
  // been accepted, and calling it on every job view would log noise for every
  // job that has not got that far.
  const depositDue =
    job.status === "awaiting_deposit" && !deposit.paid ? await getDepositDue(jobId) : null;

  // Same rule: the RPC raises unless a quote has been accepted, so asking on
  // every view would log noise for every job that never got that far.
  const balanceDue = job.status === "awaiting_balance" ? await getBalanceDue(jobId) : null;
  const balance = legState(payments, "balance");

  const presentation = jobStatus(job.status);

  // Statuses where an artisan is being looked for. `offer_sent` counts: from
  // the client's side "someone is deciding right now" is still the search.
  const isMatching = ["posted", "matching", "offer_sent"].includes(job.status);
  const awaitingDecision = job.status === "quote_sent" && quote?.status === "sent";
  const isInvoiceable = INVOICEABLE_STATUSES.includes(
    job.status as (typeof INVOICEABLE_STATUSES)[number],
  );
  const point =
    job.location_lat !== null && job.location_lng !== null
      ? { lat: job.location_lat, lng: job.location_lng }
      : null;

  // The client's own pictures of the problem, and the artisan's of the finished
  // work. Two different things that were being shown as one pile.
  const completionIds = new Set(
    photoRows.filter((row) => row.stage === "completion").map((row) => row.id),
  );
  const requestPhotos = photos.filter((photo) => !completionIds.has(photo.id));
  const completionPhotos = photos.filter((photo) => completionIds.has(photo.id));

  // pb-28 clears the fixed tab bar. The bar is out of flow, so it cannot
  // reserve its own space — every screen under it owns that padding.
  return (
    <div className="space-y-7 pb-28">
      {/* While the job is running, what it says changes without the client
          doing anything — an artisan sets out, a price arrives. */}
      {presentation.group === "active" && <RefreshOnReturn />}

      {justPosted && <PostedBanner />}

      <JobDetailHeader
        back="/client/jobs"
        backLabel="Back to all jobs"
        icon={job.category?.icon ?? "wrench"}
        title={job.category?.name ?? "Your job"}
        meta={`${job.reference} · posted ${timeAgo(job.created_at)}`}
      />

      {/* ---- What is happening ------------------------------------------- */}
      <JobStatusHero
        status={job.status}
        blurb={presentation.blurb}
        footer={
          provider &&
          contact && (
            <CounterpartyCard
              on="dark"
              name={contact.fullName}
              phone={contact.phone}
              role={job.category?.name ?? "Artisan"}
              rating={{ average: provider.ratingAvg, count: provider.ratingCount }}
              jobsCompleted={provider.jobsCompleted}
              verified
            />
          )
        }
      >
        {/* The honest version of a spinner. PLAN.md §6 is explicit that a silent
            wait is the failure mode here, so the hero says what the matcher is
            actually doing, how far out it has looked, and how many artisans it
            has already asked. It polls itself, so when somebody accepts, this
            becomes the "artisan assigned" screen unaided. */}
        {isMatching && progress && <MatchingProgress progress={progress} passCount={PASS_COUNT} />}
      </JobStatusHero>

      {/* The one state where the platform has run out of automatic options and
          a human has to take over. `settings.support_phone` is admin-only under
          RLS, so the number is the one compiled in rather than a read that
          would always come back empty for a client. */}
      {job.status === "unmatched" && (
        <a
          href="tel:+233000000000"
          className="flex min-h-13 items-center justify-center gap-2 rounded-full border border-hairline bg-white text-ui font-semibold text-navy-900 transition-colors duration-[var(--duration-fast)] hover:border-azure-300 hover:bg-azure-50"
        >
          <Phone className="size-4" aria-hidden />
          Call support
        </a>
      )}

      {/* ---- What you have to do ------------------------------------------
          Everything in this band is waiting on the client, and at most one of
          them is ever true at a time. It sits directly under the status and
          above everything they already know, because burying the one thing
          asking for an answer under their own photographs would be the single
          genuine usability failure available on this page. */}

      {job.status === "awaiting_deposit" && depositDue !== null && (
        <MomoPayPanel
          jobId={job.id}
          leg="deposit"
          amountDue={depositDue}
          defaultNetwork={profile ? detectMomoNetwork(profile.phone) : null}
          lastFailure={deposit.lastFailure?.failure_reason ?? null}
        />
      )}

      {awaitingDecision && quote && (
        <DetailSection title="Your artisan has sent a price" className="animate-fade-up">
          <p className="mb-3.5 -mt-1 text-note leading-relaxed text-copy-muted">
            Nothing is charged until you accept, and nobody travels until the deposit is paid.
          </p>
          <QuoteReview
            quote={quote}
            items={quote.items}
            reference={job.reference}
            rejectionsLeft={Math.max(0, PASS_COUNT - (job.quote_rejections ?? 0))}
          />
        </DetailSection>
      )}

      {/* The artisan has marked the work done and it is the client's move. The
          photographs come first: signing off on work you have not been shown is
          not a signature, it is a formality. */}
      {job.status === "awaiting_signoff" && (
        <div className="space-y-4">
          {completionPhotos.length > 0 && (
            <DetailSection title="The finished work">
              <PhotoGrid photos={completionPhotos} />
            </DetailSection>
          )}
          {/* Sign-off and payment are two steps, not one: mobile money needs a
              fresh prompt the client approves, so the money cannot move on the
              signature itself (PLAN.md §4). */}
          <SignOff jobId={jobId} />
        </div>
      )}

      {job.status === "awaiting_balance" && balanceDue !== null && (
        <MomoPayPanel
          jobId={jobId}
          leg="balance"
          amountDue={balanceDue}
          defaultNetwork={profile ? detectMomoNetwork(profile.phone) : null}
          lastFailure={balance.lastFailure?.failure_reason ?? null}
        />
      )}

      {/* The rating comes first on a finished job. It is the one thing we want
          from the client at this point, and burying it under the receipt is how
          a marketplace ends up with no reviews. */}
      {isFinished && job.provider_id && <RateJob jobId={jobId} existing={rating} />}

      {/* ---- What you asked for -------------------------------------------- */}
      <DetailSection title="What you asked for">
        <DetailPanel className="space-y-4">
          {job.description?.trim() ? (
            <p className="text-ui leading-relaxed whitespace-pre-wrap text-navy-900">
              {job.description}
            </p>
          ) : (
            <p className="text-ui text-copy-muted">Described by voice note.</p>
          )}

          {job.voice_note_path && (
            <div className="flex items-center gap-2.5 rounded-[1rem] bg-canvas p-2.5">
              <Mic className="size-4 shrink-0 text-navy-800" aria-hidden />
              {voiceNoteUrl ? (
                <audio src={voiceNoteUrl} controls preload="none" className="h-9 min-w-0 flex-1" />
              ) : (
                <span className="text-note text-copy-muted">Voice note attached</span>
              )}
            </div>
          )}

          {/* Scheduling landed in migration 0023 and nothing has ever shown it
              back. Somebody who chose Thursday morning should be able to see
              that they did — and it is a preference rather than a booking, so
              the line says when they asked for, not when it is confirmed. */}
          <div className="flex items-center gap-2.5 border-t border-hairline pt-3.5 text-note">
            <CalendarClock className="size-4 shrink-0 text-copy-muted" aria-hidden />
            <span className="text-copy-muted">You asked for</span>
            <span className="ml-auto text-right font-semibold text-navy-900">
              {scheduleSummary(job.preferred_date, job.preferred_window)}
            </span>
          </div>
        </DetailPanel>

        {requestPhotos.length > 0 && <PhotoGrid photos={requestPhotos} className="mt-3" />}
      </DetailSection>

      {/* Once a job is finished the completion photographs stop being a thing
          to check and become part of the record — so they move down here rather
          than staying in the action band where the sign-off put them. */}
      {isFinished && completionPhotos.length > 0 && (
        <DetailSection title="The finished work">
          <PhotoGrid photos={completionPhotos} />
        </DetailSection>
      )}

      {/* ---- Where --------------------------------------------------------- */}
      <DetailSection title="Where">
        <div className="overflow-hidden rounded-[1.25rem] border border-hairline bg-white">
          {/* No `onChange`. This is a Server Component, and a function prop
              cannot cross into a Client Component. */}
          {point && <LocationMap value={point} interactive={false} className="h-44 w-full" />}

          <div className="space-y-1.5 p-4">
            {job.landmark && (
              <p className="flex items-start gap-2.5 text-ui font-semibold text-navy-900">
                <MapPin className="mt-0.5 size-4 shrink-0 text-azure-500" aria-hidden />
                <span>{job.landmark}</span>
              </p>
            )}
            {job.address_text && <p className="pl-7 text-note text-copy-muted">{job.address_text}</p>}
            {job.ghanapost_code && (
              <p className="tabular pl-7 font-mono text-note text-copy-muted">
                {job.ghanapost_code}
              </p>
            )}
          </div>
        </div>
      </DetailSection>

      {/* ---- What happened -------------------------------------------------- */}

      {/* Above the timeline: somebody checking a job after paying is looking for
          the money, not for the history of the match. */}
      {payments.length > 0 && (
        <DetailSection title="Payments">
          <PaymentReceipt payments={payments} headingLevel={3} />
        </DetailSection>
      )}

      {/* The invoice only exists once the money is in — before that the quote is
          the document that describes the price. */}
      {isInvoiceable && (
        <Link
          href={`/client/jobs/${jobId}/invoice`}
          className="flex min-h-13 items-center gap-2.5 rounded-[1.25rem] border border-hairline bg-white px-4 text-ui font-semibold text-navy-900 transition-colors duration-[var(--duration-fast)] hover:border-azure-300 hover:bg-azure-50"
        >
          <FileText className="size-4 shrink-0 text-azure-500" aria-hidden />
          View invoice
          <span className="tabular ml-auto font-mono text-2xs text-copy-muted">
            {invoiceNumber(job.reference)}
          </span>
        </Link>
      )}

      <DetailSection title="History">
        <DetailPanel>
          <JobTimeline events={events} />
        </DetailPanel>
      </DetailSection>

      {/* The two ways out, last and quiet. Neither is something we want a
          client to reach for, and both have to be findable without help. */}
      {(isFinished || isCancellable(job.status)) && (
        <div className="space-y-2.5 border-t border-hairline pt-5">
          {isFinished && <RaiseDispute jobId={jobId} existing={dispute} />}
          {isCancellable(job.status) && <CancelJob jobId={job.id} />}
        </div>
      )}
    </div>
  );
}
