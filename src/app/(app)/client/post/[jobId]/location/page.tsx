import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LocationForm } from "@/app/(app)/client/post/[jobId]/location/_components/location-form";
import { getClientJob } from "@/lib/jobs/queries";

export const metadata: Metadata = { title: "Where is the job?" };

export default async function LocationStepPage({
  params,
}: PageProps<"/client/post/[jobId]/location">) {
  const { jobId } = await params;

  const job = await getClientJob(jobId);
  if (!job || job.status !== "draft") notFound();

  // These come from the STORED GENERATED mirrors of `location` (migration
  // 0007). The geography column itself arrives as WKB hex and is unusable here.
  const point =
    job.location_lat !== null && job.location_lng !== null
      ? { lat: job.location_lat, lng: job.location_lng }
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-space text-title-sm font-bold text-balance text-navy-900">
          Where is the job?
        </h1>
        <p className="text-note leading-relaxed text-copy-muted">
          We match you with the closest available artisan, so the pin matters more than the
          address. Put it on the building, then add the landmark you would give over the phone.
        </p>
      </div>

      <LocationForm
        jobId={job.id}
        initialPoint={point}
        initialAddress={job.address_text}
        initialLandmark={job.landmark}
        initialGhanaPost={job.ghanapost_code}
      />
    </div>
  );
}
