import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff, MapPin, Mic, Pencil } from "lucide-react";

import { LocationMap } from "@/components/jobs/location-map";
import { PostButton } from "@/app/(app)/client/post/[jobId]/review/_components/post-button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getClientJob,
  listJobPhotos,
  signJobPhotos,
  signVoiceNote,
} from "@/lib/jobs/queries";

export const metadata: Metadata = { title: "Review your request" };

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
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ink-900">Ready to go out</h2>
        <p className="max-w-prose text-[0.9375rem] text-ink-600">
          This is what a verified artisan near you will see. Check it reads the way you would say
          it, then post.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5">
          <ReviewSection title="The problem" editHref={`/client/post/${job.id}/describe`}>
            {job.description?.trim() ? (
              <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink-800">
                {job.description}
              </p>
            ) : (
              <p className="text-[0.9375rem] text-ink-500">
                No written description — your voice note does the explaining.
              </p>
            )}

            {photos.length > 0 && (
              <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
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
                        sizes="120px"
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

            {job.voice_note_path && (
              <div className="mt-3 flex items-center gap-2.5 rounded-field border border-ink-200 bg-ink-50 p-2.5">
                <Mic className="size-4 shrink-0 text-ink-500" aria-hidden />
                {voiceNoteUrl ? (
                  <audio src={voiceNoteUrl} controls preload="none" className="h-9 min-w-0 flex-1" />
                ) : (
                  <span className="text-sm text-ink-600">Voice note attached</span>
                )}
              </div>
            )}
          </ReviewSection>

          <ReviewSection title="Where" editHref={`/client/post/${job.id}/location`}>
            {point ? (
              <div className="space-y-3">
                {/* No `onChange`. This is a Server Component, and a function
                    prop cannot cross into a Client Component. */}
                <LocationMap value={point} interactive={false} className="h-40 w-full" />

                <div className="space-y-1.5 text-[0.9375rem]">
                  {job.landmark && (
                    <p className="flex items-start gap-2 text-ink-800">
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
              </div>
            ) : (
              <p className="text-[0.9375rem] text-danger-600">
                No pin yet — add one before you can post.
              </p>
            )}
          </ReviewSection>
        </CardContent>
      </Card>

      {/* What happens next, stated before they commit rather than after. The
          product's whole promise is that nothing costs anything until a price
          is agreed, and this is the screen where that has to be legible. */}
      <Card className="border-brand-200 bg-brand-50">
        <CardContent className="space-y-2">
          <h3 className="text-sm font-semibold text-brand-900">What happens next</h3>
          <ol className="space-y-1.5 text-sm leading-relaxed text-brand-900/85">
            <li>1. We offer the job to the nearest available verified artisan.</li>
            <li>2. They send you an itemised price — labour and materials, separately.</li>
            <li>3. You accept or decline. Decline and we find you someone else.</li>
            <li>4. Only once you accept do you pay a deposit, and only then do they travel.</li>
          </ol>
        </CardContent>
      </Card>

      <PostButton jobId={job.id} />
    </div>
  );
}

function ReviewSection({
  title,
  editHref,
  children,
}: {
  title: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 border-ink-200 [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</h3>

        <Link
          href={editHref}
          className="inline-flex items-center gap-1 rounded-field text-sm text-brand-700 transition-colors hover:text-brand-800"
        >
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Link>
      </div>

      {children}
    </section>
  );
}
