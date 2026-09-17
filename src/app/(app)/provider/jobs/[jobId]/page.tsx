import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ImageOff, MapPin, Mic } from "lucide-react";

import { QuoteBuilder } from "@/app/(app)/provider/jobs/[jobId]/_components/quote-builder";
import { ExecutionControls } from "@/components/jobs/execution-controls";
import { CompletionPhotos } from "@/components/jobs/completion-photos";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { QuoteSummary } from "@/components/marketplace/quote-summary";
import { getAssignedJob, getLatestQuote, getQuoteContext } from "@/lib/jobs/matching";
import { getMyProvider } from "@/lib/providers/queries";
import { jobStatus } from "@/lib/jobs/status";
import { listJobPhotos, signJobPhotos, signVoiceNote } from "@/lib/jobs/queries";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Job" };

/**
 * The artisan's job screen.
 *
 * In Phase 3 this screen does exactly one thing after acceptance: price the
 * work. Travel status, completion photos and sign-off land here in Phase 5, so
 * the layout already reserves the shape — job on the left, the action of the
 * moment on the right — rather than being a quote builder that later has to be
 * dismantled.
 *
 * Which action shows is decided by status, not by a tab: `quote_pending` means
 * build one, `quote_sent` means wait, and anything past that means the price is
 * settled and the screen is a record.
 */
export default async function ProviderJobPage({ params }: PageProps<"/provider/jobs/[jobId]">) {
  const { jobId } = await params;

  const [job, provider] = await Promise.all([getAssignedJob(jobId), getMyProvider()]);

  if (!job || !provider || job.provider_id !== provider.profile_id) notFound();

  const [photoRows, quote, context] = await Promise.all([
    listJobPhotos(jobId),
    getLatestQuote(jobId),
    getQuoteContext(jobId),
  ]);

  const [photos, voiceNoteUrl] = await Promise.all([
    signJobPhotos(photoRows),
    signVoiceNote(job.voice_note_path),
  ]);

  const status = jobStatus(job.status);
  const canQuote = job.status === "quote_pending";
  const awaitingClient = job.status === "quote_sent";

  // The execution half of the job. `advance_job_execution` decides what is
  // legal; this only decides what to put on screen.
  const onSite = ["deposit_paid", "en_route", "arrived", "in_progress"].includes(job.status);
  const completionPhotos = photoRows.filter((photo) => photo.stage === "completion");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/provider"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          My work
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-card bg-brand-50 text-brand-700">
              <CategoryIcon name={job.category?.icon ?? "wrench"} className="size-6" />
            </span>
            <div className="space-y-1">
              <h1 className="text-2xl leading-tight font-semibold text-ink-900">
                {job.category?.name ?? "Job"}
              </h1>
              <p className="tabular font-mono text-xs text-ink-500">{job.reference}</p>
            </div>
          </div>

          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          {onSite && (
            <ExecutionControls
              jobId={jobId}
              status={job.status}
              completionPhotoCount={completionPhotos.length}
            />
          )}

          {/* Only once work is under way. Asking for a "finished work" photo
              before anything has been done is asking for a photo of a problem. */}
          {job.status === "in_progress" && (
            <CompletionPhotos
              jobId={jobId}
              photos={photos.filter((photo) =>
                completionPhotos.some((row) => row.id === photo.id),
              )}
            />
          )}

          {canQuote && (
            <QuoteBuilder
              jobId={jobId}
              context={context}
              existing={
                quote && quote.status === "draft"
                  ? {
                      id: quote.id,
                      notes: quote.notes,
                      items: quote.items.map((item) => ({
                        kind: item.kind,
                        description: item.description,
                        quantity: String(item.quantity),
                        unitPrice: String(item.unit_price),
                      })),
                    }
                  : null
              }
            />
          )}

          {awaitingClient && quote && (
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-info-50 text-info-700">
                    <Clock className="size-5" aria-hidden />
                  </span>
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-ink-900">
                      Your price is with the client
                    </h2>
                    <p className="max-w-prose text-sm leading-relaxed text-ink-600">
                      Sent {quote.sent_at ? timeAgo(quote.sent_at) : "just now"}. Nothing happens
                      until they accept — and if they decline, the job goes back out to other
                      artisans rather than being cancelled.
                    </p>
                  </div>
                </div>

                <QuoteSummary
                  subtotal={Number(quote.subtotal)}
                  transportFee={Number(quote.transport_fee)}
                  commissionPct={Number(quote.service_fee_pct)}
                />
              </CardContent>
            </Card>
          )}

          {!canQuote && !awaitingClient && quote && (
            <Card>
              <CardContent className="space-y-4">
                <h2 className="text-base font-semibold text-ink-900">The agreed price</h2>
                <QuoteSummary
                  subtotal={Number(quote.subtotal)}
                  transportFee={Number(quote.transport_fee)}
                  commissionPct={Number(quote.service_fee_pct)}
                />
              </CardContent>
            </Card>
          )}

          {photos.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-800">What the client sent</h2>
              <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {photos.map((photo) => (
                  <li
                    key={photo.id}
                    className="relative aspect-square overflow-hidden rounded-card border border-ink-200 bg-ink-100"
                  >
                    {photo.url ? (
                      <Image
                        src={photo.url}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 33vw, 160px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-ink-400">
                        <ImageOff className="size-5" aria-hidden />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-sm font-semibold text-ink-800">The job</h2>

              {job.description ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-700">
                  {job.description}
                </p>
              ) : (
                <p className="text-sm text-ink-400">No written description.</p>
              )}

              {voiceNoteUrl && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-ink-600">
                    <Mic className="size-3.5" aria-hidden />
                    Voice note
                  </p>
                  <audio src={voiceNoteUrl} controls preload="none" className="w-full" />
                </div>
              )}

              <div className="flex items-start gap-2.5 border-t border-ink-100 pt-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />
                <div className="min-w-0 space-y-0.5 text-sm">
                  {job.landmark && (
                    <p className="leading-snug font-medium text-ink-900">{job.landmark}</p>
                  )}
                  {job.address_text && <p className="text-ink-600">{job.address_text}</p>}
                  {job.ghanapost_code && (
                    <p className="tabular font-mono text-xs text-ink-500">{job.ghanapost_code}</p>
                  )}
                  {job.location_lat !== null && job.location_lng !== null && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${job.location_lat},${job.location_lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block pt-1 text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
                    >
                      Open directions
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
