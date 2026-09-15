import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DescribeForm } from "@/app/(app)/client/post/[jobId]/describe/_components/describe-form";
import {
  getClientJob,
  listJobPhotos,
  signJobPhotos,
  signVoiceNote,
} from "@/lib/jobs/queries";

export const metadata: Metadata = { title: "Describe the job" };

export default async function DescribeStepPage({
  params,
}: PageProps<"/client/post/[jobId]/describe">) {
  const { jobId } = await params;

  // The layout has already established that this is the caller's draft. Read it
  // again rather than passing it down: a Server Component is its own request,
  // and a page that trusts its layout to have checked is a page that stops
  // being safe the moment someone renders it from somewhere else.
  const job = await getClientJob(jobId);
  if (!job || job.status !== "draft") notFound();

  const photoRows = await listJobPhotos(jobId);
  const [photos, voiceNoteUrl] = await Promise.all([
    signJobPhotos(photoRows),
    signVoiceNote(job.voice_note_path),
  ]);

  return (
    <DescribeForm
      jobId={job.id}
      initialDescription={job.description}
      photos={photos}
      voiceNoteUrl={voiceNoteUrl}
      hasVoiceNote={Boolean(job.voice_note_path)}
    />
  );
}
