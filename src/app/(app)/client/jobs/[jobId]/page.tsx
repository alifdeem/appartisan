import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageOff, MapPin, Mic, Phone } from "lucide-react";

import { CancelJob } from "@/components/jobs/cancel-job";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { JobProgress } from "@/components/jobs/job-progress";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { JobTimeline } from "@/components/jobs/job-timeline";
import { LocationMap } from "@/components/jobs/location-map";
import { Card, CardContent } from "@/components/ui/card";
import { isCancellable, jobStatus } from "@/lib/jobs/status";
import {
  getClientJob,
  listJobEvents,
  listJobPhotos,
  signJobPhotos,
  signVoiceNote,
} from "@/lib/jobs/queries";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Your job" };

/**
 * The one screen that changes with state (PLAN.md §11).
 *
 * Phase 1 only reaches `posted`, so what is here is the frame: status, the
 * progress rail, everything the client submitted, and the audit trail. The
 * later phases hang the quote, the map tracking, the sign-off and the receipt
 * off the same page rather than adding screens — a client should have one place
 * to look at a job, not six.
 */
export default async function JobDetailPage({ params }: PageProps<"/client/jobs/[jobId]">) {
  const { jobId } = await params;

  const job = await getClientJob(jobId);
  if (!job) notFound();

  // A draft has no job screen — it has the posting flow it was abandoned in.
  if (job.status === "draft") notFound();

  const photoRows = await listJobPhotos(jobId);
  const [photos, voiceNoteUrl, events] = await Promise.all([
    signJobPhotos(photoRows),
    signVoiceNote(job.voice_note_path),
    listJobEvents(jobId),
  ]);

  const presentation = jobStatus(job.status);
  const point =
    job.location_lat !== null && job.location_lng !== null
      ? { lat: job.location_lat, lng: job.location_lng }
      : null;

  return (
    <div className="space-y-6">
      <Link
        href="/client/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All jobs
      </Link>

      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-field bg-brand-50 text-brand-700">
          <CategoryIcon name={job.category?.icon ?? "wrench"} className="size-[1.375rem]" />
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink-900">
              {job.category?.name ?? "Service"}
            </h1>
            <JobStatusBadge status={job.status} />
          </div>

          <p className="tabular font-mono text-sm text-ink-500">
            {job.reference} · posted {timeAgo(job.created_at)}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-5">
          <JobProgress status={job.status} />

          <p className="border-t border-ink-200 pt-4 text-[0.9375rem] leading-relaxed text-ink-700">
            {presentation.blurb}
          </p>

          {/* The honest version of a spinner. PLAN.md §6 is explicit that a
              silent wait is the failure mode here, so the screen says what the
              matcher is actually doing and how far out it has looked. */}
          {presentation.group === "active" && presentation.awaitingUs && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-field bg-ink-50 px-3.5 py-2.5 text-sm text-ink-600">
              <span className="tabular">
                Searching within{" "}
                <span className="font-mono font-medium text-ink-800">
                  {Number(job.matching_radius_km)}km
                </span>
              </span>
              {job.matching_pass > 0 && (
                <span className="tabular">
                  Pass <span className="font-mono font-medium text-ink-800">{job.matching_pass}</span>
                </span>
              )}
            </div>
          )}

          {job.status === "unmatched" && (
            <a
              href="tel:+233000000000"
              className="inline-flex min-h-11 items-center gap-2 rounded-field border border-ink-300 bg-ink-0 px-4 text-sm font-medium text-ink-800 shadow-xs transition-colors hover:bg-ink-50"
            >
              <Phone className="size-4" aria-hidden />
              Call support
            </a>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                What you told us
              </h2>

              {job.description?.trim() ? (
                <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink-800">
                  {job.description}
                </p>
              ) : (
                <p className="text-[0.9375rem] text-ink-500">Described by voice note.</p>
              )}

              {job.voice_note_path && (
                <div className="flex items-center gap-2.5 rounded-field border border-ink-200 bg-ink-50 p-2.5">
                  <Mic className="size-4 shrink-0 text-ink-500" aria-hidden />
                  {voiceNoteUrl ? (
                    <audio
                      src={voiceNoteUrl}
                      controls
                      preload="none"
                      className="h-9 min-w-0 flex-1"
                    />
                  ) : (
                    <span className="text-sm text-ink-600">Voice note attached</span>
                  )}
                </div>
              )}

              {photos.length > 0 && (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((photo) => (
                    <li
                      key={photo.id}
                      className="relative aspect-square overflow-hidden rounded-field border border-ink-200 bg-ink-100"
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
                          <ImageOff className="size-4" aria-hidden />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Where
              </h2>

              {point && (
                <LocationMap
                  value={point}
                  onChange={() => {}}
                  interactive={false}
                  className="h-44 w-full"
                />
              )}

              <div className="space-y-1.5">
                {job.landmark && (
                  <p className="flex items-start gap-2 text-[0.9375rem] text-ink-800">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />
                    <span>{job.landmark}</span>
                  </p>
                )}
                {job.address_text && (
                  <p className="pl-6 text-sm text-ink-600">{job.address_text}</p>
                )}
                {job.ghanapost_code && (
                  <p className="tabular pl-6 font-mono text-sm text-ink-600">
                    {job.ghanapost_code}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                History
              </h2>
              <JobTimeline events={events} />
            </CardContent>
          </Card>

          {isCancellable(job.status) && <CancelJob jobId={job.id} />}
        </div>
      </div>
    </div>
  );
}
