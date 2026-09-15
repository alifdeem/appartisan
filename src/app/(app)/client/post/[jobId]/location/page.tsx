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
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ink-900">Where is the job?</h2>
        <p className="max-w-prose text-[0.9375rem] text-ink-600">
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
