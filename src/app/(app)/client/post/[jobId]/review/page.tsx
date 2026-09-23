import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronRight, ImageOff, MapPin, Mic } from "lucide-react";

import { LocationMap } from "@/components/jobs/location-map";
import { scheduleSummary } from "@/lib/jobs/schedule";
import { PostButton } from "@/app/(app)/client/post/[jobId]/review/_components/post-button";
import {
  getClientJob,
  listJobPhotos,
  signJobPhotos,
  signVoiceNote,
} from "@/lib/jobs/queries";

export const metadata: Metadata = { title: "Review your request" };

/**
 * The last screen before it is real — the reference's `@6-review and confirm`.
 *
 * The reference's summary is a stack of rows inside one card, each row a
 * chevron back to the step that owns it. That is the shape here, with two
 * differences the product forces:
 *
 *  • **No price row.** The reference shows `$100` on this card. Nothing has
 *    priced this job yet — that is the artisan's job after they have read it
 *    (PLAN.md §9), and it is the whole point of the flow that follows. A price
 *    here would be a number we invented on the screen where the client decides
 *    whether to trust our numbers.
 *  • **The date row says a preference, not a booking.** The reference shows
 *    "12 Dec • 10 Am" as though it were an appointment. A posted job is
 *    dispatched to the nearest available artisan immediately whatever is chosen
 *    here, so the row reads as what it is and the screen says the exact time is
 *    agreed with the artisan. See migration 0023.
 *
 * The whole row is the link, not a small "Edit" beside it. On a phone the
 * target is then 44px tall and the width of the screen rather than a 30px word,
 * and the chevron says the same thing the word did.
 */
export default async function ReviewStepPage({
  params,
}: PageProps<"/client/post/[jobId]/review">) {
  const { jobId } = await params;

  const job = await getClientJob(jobId);
  if (!job || job.status !== "draft") notFound();

  const photoRows = await listJobPhotos(jobId);
  const [photos, voiceNoteUrl] = await Promise.all([
    signJobPhotos(photoRows),
    signVoiceNote(job.voice_note_path),
  ]);

  const point =
    job.location_lat !== null && job.location_lng !== null
      ? { lat: job.location_lat, lng: job.location_lng }
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-space text-title-sm font-bold text-balance text-navy-900">
          Ready to go out
        </h1>
        <p className="text-note leading-relaxed text-copy-muted">
          This is what a verified artisan near you will see. Check it reads the way you would say
          it, then post.
        </p>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-hairline bg-white shadow-[var(--shadow-float)]">
        <ReviewRow title="The problem" href={`/client/post/${job.id}/describe`}>
          {job.description?.trim() ? (
            <p className="line-clamp-3 text-note leading-relaxed text-navy-900">
              {job.description}
            </p>
          ) : (
            <p className="text-note text-copy-muted">
              No written description — your voice note does the explaining.
            </p>
          )}

          {photos.length > 0 && (
            <ul className="mt-2.5 flex gap-1.5">
              {photos.slice(0, 5).map((photo) => (
                <li
                  key={photo.id}
                  className="relative size-11 shrink-0 overflow-hidden rounded-[0.625rem] border border-hairline bg-azure-50"
                >
                  {photo.url ? (
                    <Image
                      src={photo.url}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-navy-800/35">
                      <ImageOff className="size-4" aria-hidden />
                    </span>
                  )}
                </li>
              ))}

              {photos.length > 5 && (
                <li className="tabular grid size-11 shrink-0 place-items-center rounded-[0.625rem] bg-azure-50 font-mono text-2xs font-semibold text-navy-800">
                  +{photos.length - 5}
                </li>
              )}
            </ul>
          )}

        </ReviewRow>

        {/* Playback sits in its own strip rather than inside the row above,
            because that row is a link: an `<audio controls>` inside an anchor
            means pressing play navigates to the describe step instead. Being
            able to hear the note back before posting is the only way to catch a
            recording that captured nothing, so it is worth the extra strip. */}
        {job.voice_note_path && (
          <div className="flex items-center gap-2.5 border-t border-hairline px-5 py-3.5">
            <Mic className="size-4 shrink-0 text-azure-500" aria-hidden />
            {voiceNoteUrl ? (
              <audio src={voiceNoteUrl} controls preload="none" className="h-9 min-w-0 flex-1" />
            ) : (
              <span className="text-note text-copy-muted">Voice note attached</span>
            )}
          </div>
        )}

        <ReviewRow title="When" href={`/client/post/${job.id}/schedule`}>
          <p className="flex items-start gap-1.5 text-note leading-relaxed text-navy-900">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-azure-500" aria-hidden />
            <span>{scheduleSummary(job.preferred_date, job.preferred_window)}</span>
          </p>
          <p className="mt-1 pl-5.5 text-2xs text-copy-muted">
            You&rsquo;ll agree the exact time with the artisan.
          </p>
        </ReviewRow>

        <ReviewRow title="Where" href={`/client/post/${job.id}/location`}>
          {point ? (
            <div className="space-y-2.5">
              {job.landmark && (
                <p className="flex items-start gap-1.5 text-note leading-relaxed text-navy-900">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-azure-500" aria-hidden />
                  <span>{job.landmark}</span>
                </p>
              )}

              {job.address_text && (
                <p className="text-note text-copy-muted">{job.address_text}</p>
              )}

              {job.ghanapost_code && (
                <p className="tabular font-mono text-2xs text-copy-muted">{job.ghanapost_code}</p>
              )}

              {/* No `onChange`. This is a Server Component, and a function prop
                  cannot cross into a Client Component. */}
              <LocationMap
                value={point}
                interactive={false}
                className="h-28 w-full overflow-hidden rounded-[0.875rem]"
              />
            </div>
          ) : (
            <p className="text-note text-danger-600">No pin yet — add one before you can post.</p>
          )}
        </ReviewRow>
      </div>

      {/* What happens next, stated before they commit rather than after. The
          product's whole promise is that nothing costs anything until a price
          is agreed, and this is the screen where that has to be legible. */}
      <section className="rounded-[1.5rem] bg-azure-50 p-5">
        <h2 className="font-space text-note font-bold text-navy-900">What happens next</h2>
        <ol className="mt-3 space-y-2.5">
          {[
            "We offer the job to the nearest available verified artisan.",
            "They send you an itemised price — labour and materials, separately.",
            "You accept or decline. Decline and we find you someone else.",
            "Only once you accept do you pay a deposit, and only then do they travel.",
          ].map((step, index) => (
            <li key={step} className="flex gap-2.5 text-note leading-relaxed text-navy-900/85">
              <span className="tabular grid size-5 shrink-0 place-items-center rounded-full bg-navy-800 font-mono text-[0.625rem] font-bold text-white">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <PostButton jobId={job.id} />
    </div>
  );
}

function ReviewRow({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 border-hairline p-5 transition-colors duration-[var(--duration-fast)] not-first:border-t hover:bg-azure-50/40"
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-2xs font-medium tracking-[0.07em] text-copy-muted uppercase">
          {title}
        </h2>
        <div className="mt-2">{children}</div>
      </div>

      <ChevronRight
        className="mt-0.5 size-4 shrink-0 text-hairline transition-transform duration-[var(--duration-fast)] ease-out-strong group-hover:translate-x-0.5 group-hover:text-azure-500"
        aria-hidden
      />
    </Link>
  );
}
