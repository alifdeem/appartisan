import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, Clock, MapPin, Mic, Navigation } from "lucide-react";

import { QuoteBuilder } from "@/app/(app)/provider/jobs/[jobId]/_components/quote-builder";
import { CompletionPhotos } from "@/components/jobs/completion-photos";
import { CounterpartyCard } from "@/components/jobs/counterparty-card";
import { DetailPanel, DetailSection, JobDetailHeader } from "@/components/jobs/job-detail-chrome";
import { ExecutionControls } from "@/components/jobs/execution-controls";
import { JobStatusHero } from "@/components/jobs/job-status-hero";
import { LocationMap } from "@/components/jobs/location-map";
import { PhotoGrid } from "@/components/jobs/photo-grid";
import { RefreshOnReturn } from "@/components/jobs/refresh-on-return";
import { QuoteSummary } from "@/components/marketplace/quote-summary";
import { getAssignedJob, getLatestQuote, getQuoteContext } from "@/lib/jobs/matching";
import { getJobCounterparty, listJobPhotos, signJobPhotos, signVoiceNote } from "@/lib/jobs/queries";
import { getMyProvider } from "@/lib/providers/queries";
import { jobStatus } from "@/lib/jobs/status";
import { scheduleSummary } from "@/lib/jobs/schedule";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Job" };

/**
 * The artisan's job screen.
 *
 * **Written for somebody standing outside a gate.** That is not a figure of
 * speech — it is the situation this screen is used in, one-handed, in daylight,
 * often while somebody waits. Everything follows from it:
 *
 *  • **The next action is the first thing, inside the status hero.** One button
 *    at a time, white on navy, the only white-filled object above the fold.
 *    Which button is decided by status; whether it is *allowed* is decided by
 *    `advance_job_execution` (0015-0017), never here.
 *
 *  • **The address is second, with directions on it.** It used to be in an
 *    `<aside>` at the bottom of a two-column grid that never rendered — so the
 *    single most useful thing on an artisan's screen was three scrolls down,
 *    and "Open directions" was a text link inside it. Addresses in Accra are
 *    landmarks rather than street numbers, which makes the map and the landmark
 *    line load-bearing rather than decorative.
 *
 *  • **The client's phone number is third**, which it has never been at all.
 *    `0003_rls.sql:74` has always permitted it — see `CounterpartyCard`. With
 *    no in-app messaging (PLAN.md §14), a call is how a locked gate gets
 *    opened, and an artisan who cannot make one just stands there.
 *
 * Everything below that is reference: what the client asked for, the money, the
 * photographs. Read once when the job is accepted, rarely afterwards.
 *
 * **`in_progress` is the one exception to the order.** The finished-work photos
 * are hoisted directly under the hero there, because `advance_job_execution`
 * refuses to move the job on without one — leaving the blocker at the bottom of
 * the screen means the disabled button at the top has no visible cause.
 */
export default async function ProviderJobPage({ params }: PageProps<"/provider/jobs/[jobId]">) {
  const { jobId } = await params;

  const [job, provider] = await Promise.all([getAssignedJob(jobId), getMyProvider()]);

  if (!job || !provider || job.provider_id !== provider.profile_id) notFound();

  const [photoRows, quote, context, client] = await Promise.all([
    listJobPhotos(jobId),
    getLatestQuote(jobId),
    getQuoteContext(jobId),
    getJobCounterparty(job.client_id),
  ]);

  const [photos, voiceNoteUrl] = await Promise.all([
    signJobPhotos(photoRows),
    signVoiceNote(job.voice_note_path),
  ]);

  const status = jobStatus(job.status);
  const live = status.group === "active";
  const canQuote = job.status === "quote_pending";
  const awaitingClient = job.status === "quote_sent";

  // The execution half of the job. `advance_job_execution` decides what is
  // legal; this only decides what to put on screen.
  const onSite = ["deposit_paid", "en_route", "arrived", "in_progress"].includes(job.status);
  // Still has a journey ahead of them. `arrived` and later do not — they are
  // standing in the room.
  const travelling = ["assigned", "quote_pending", "quote_sent", "awaiting_deposit", "deposit_paid", "en_route"].includes(
    job.status,
  );
  const completionRows = photoRows.filter((photo) => photo.stage === "completion");
  const completionIds = new Set(completionRows.map((row) => row.id));
  const completionPhotos = photos.filter((photo) => completionIds.has(photo.id));
  const clientPhotos = photos.filter((photo) => !completionIds.has(photo.id));

  const point =
    job.location_lat !== null && job.location_lng !== null
      ? { lat: job.location_lat, lng: job.location_lng }
      : null;

  return (
    // pb-28 clears the fixed tab bar. The bar is out of flow and cannot reserve
    // its own space — every screen under it owns that padding.
    <div className="space-y-7 pb-28">
      {/* An artisan locks their phone between every step of a job. */}
      {live && <RefreshOnReturn />}

      <JobDetailHeader
        back="/provider/jobs"
        backLabel="Back to your jobs"
        icon={job.category?.icon ?? "wrench"}
        title={job.category?.name ?? "Job"}
        meta={`${job.reference} · ${timeAgo(job.updated_at)}`}
      />

      {/* ---- What is happening, and the one button that moves it ---------- */}
      <JobStatusHero
        status={job.status}
        // The artisan's voice, not the client's. `blurb` addresses the person
        // who booked the work — "Your artisan is travelling to you" — which is
        // nonsense on the travelling artisan's own screen. Falls back to the
        // label rather than to `blurb` on the states an artisan can reach but
        // that carry no second voice.
        blurb={status.providerBlurb ?? status.label}
        footer={
          onSite ? (
            <ExecutionControls
              jobId={jobId}
              status={job.status}
              completionPhotoCount={completionRows.length}
            />
          ) : null
        }
      />

      {/* Only once work is under way. Asking for a "finished work" photo before
          anything has been done is asking for a photo of a problem — and at
          `in_progress` it is the thing blocking the button above. */}
      {job.status === "in_progress" && (
        <CompletionPhotos jobId={jobId} photos={completionPhotos} />
      )}

      {/* ---- Where, and how to get there ---------------------------------- */}
      <DetailSection title="Where">
        <div className="overflow-hidden rounded-[1.25rem] border border-hairline bg-white">
          {/* No `onChange`. This is a Server Component, and a function prop
              cannot cross into a Client Component. */}
          {point && <LocationMap value={point} interactive={false} className="h-40 w-full" />}

          <div className="space-y-1.5 p-4">
            {job.landmark && (
              <p className="flex items-start gap-2.5 text-ui font-semibold text-navy-900">
                <MapPin className="mt-0.5 size-4 shrink-0 text-azure-500" aria-hidden />
                <span>{job.landmark}</span>
              </p>
            )}
            {job.address_text && (
              <p className="pl-7 text-note text-copy-muted">{job.address_text}</p>
            )}
            {job.ghanapost_code && (
              <p className="tabular pl-7 font-mono text-note text-copy-muted">
                {job.ghanapost_code}
              </p>
            )}

            {/* Loud while somebody still has to get there, quiet once they
                have. A filled navy CTA on a job that was paid for last week is
                shouting about a journey nobody is making. */}
            {point && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "mt-3.5 flex min-h-13 items-center justify-center gap-2 rounded-full text-ui font-bold",
                  "transition-transform duration-[var(--duration-instant)] ease-out-strong active:scale-[0.98]",
                  travelling
                    ? "bg-linear-to-b from-navy-800 to-navy-900 text-white shadow-[var(--shadow-glow-navy)]"
                    : "border border-hairline bg-white text-navy-900 hover:border-azure-300 hover:bg-azure-50",
                )}
              >
                <Navigation className="size-5" aria-hidden />
                Open directions
              </a>
            )}
          </div>
        </div>
      </DetailSection>

      {/* ---- Who to call --------------------------------------------------- */}
      {client && (
        <DetailSection title="The customer">
          <CounterpartyCard name={client.fullName} phone={client.phone} role="Customer" />
        </DetailSection>
      )}

      {/* ---- What they asked for ------------------------------------------- */}
      <DetailSection title="The job">
        <DetailPanel className="space-y-4">
          {job.description?.trim() ? (
            <p className="text-ui leading-relaxed whitespace-pre-wrap text-navy-900">
              {job.description}
            </p>
          ) : (
            <p className="text-ui text-copy-muted">No written description — listen to the note.</p>
          )}

          {voiceNoteUrl && (
            <div className="flex items-center gap-2.5 rounded-[1rem] bg-canvas p-2.5">
              <Mic className="size-4 shrink-0 text-navy-800" aria-hidden />
              <audio src={voiceNoteUrl} controls preload="none" className="h-9 min-w-0 flex-1" />
            </div>
          )}

          {/* A preference, not a booking — migration 0023. Saying "they asked
              for" rather than "scheduled for" is the difference between an
              artisan turning up on Thursday and an artisan believing they are
              late on Wednesday. */}
          <div className="flex items-center gap-2.5 border-t border-hairline pt-3.5 text-note">
            <CalendarClock className="size-4 shrink-0 text-copy-muted" aria-hidden />
            <span className="text-copy-muted">They asked for</span>
            <span className="ml-auto text-right font-semibold text-navy-900">
              {scheduleSummary(job.preferred_date, job.preferred_window)}
            </span>
          </div>
        </DetailPanel>

        {clientPhotos.length > 0 && <PhotoGrid photos={clientPhotos} className="mt-3" />}
      </DetailSection>

      {/* ---- The money ------------------------------------------------------ */}
      {canQuote && <QuoteBuilder jobId={jobId} context={context} existing={draftOf(quote)} />}

      {awaitingClient && quote && (
        <DetailSection title="Your price is with the client">
          <div className="flex items-start gap-3 rounded-[1.25rem] border border-azure-200 bg-azure-50 p-4">
            <Clock className="mt-0.5 size-5 shrink-0 text-azure-700" aria-hidden />
            <p className="text-note leading-relaxed text-navy-900/85">
              Sent {quote.sent_at ? timeAgo(quote.sent_at) : "just now"}. Nothing happens until
              they accept — and if they decline, the job goes back out to other artisans rather
              than being cancelled.
            </p>
          </div>

          <QuoteSummary
            className="mt-3"
            subtotal={Number(quote.subtotal)}
            transportFee={Number(quote.transport_fee)}
            commissionPct={Number(quote.service_fee_pct)}
          />
        </DetailSection>
      )}

      {!canQuote && !awaitingClient && quote && (
        <DetailSection title="The agreed price">
          <QuoteSummary
            subtotal={Number(quote.subtotal)}
            transportFee={Number(quote.transport_fee)}
            commissionPct={Number(quote.service_fee_pct)}
          />
        </DetailSection>
      )}

      {/* Once the work is signed off the completion photographs stop being a
          blocker and become the record. */}
      {!onSite && completionPhotos.length > 0 && (
        <DetailSection title="The finished work">
          <PhotoGrid photos={completionPhotos} />
        </DetailSection>
      )}
    </div>
  );
}

/**
 * The quote the builder should open with.
 *
 * Only a `draft` — a sent quote is not something to carry back into an editor,
 * and `quote_pending` with a sent quote against it is a state the machine does
 * not produce anyway. Pulled out of the JSX because a nested ternary inside a
 * prop is where this kind of condition goes to be misread.
 */
function draftOf(quote: Awaited<ReturnType<typeof getLatestQuote>>) {
  if (!quote || quote.status !== "draft") return null;

  return {
    id: quote.id,
    notes: quote.notes,
    items: quote.items.map((item) => ({
      kind: item.kind,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unit_price),
    })),
  };
}
