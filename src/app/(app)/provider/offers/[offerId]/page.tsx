import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OfferDecision } from "@/app/(app)/provider/offers/[offerId]/_components/offer-decision";
import { getOffer } from "@/lib/jobs/matching";
import { getMyProvider } from "@/lib/providers/queries";
import { listJobPhotos, signJobPhotos, signVoiceNote } from "@/lib/jobs/queries";

export const metadata: Metadata = { title: "New job offer" };

/**
 * One offer, one decision, 120 seconds.
 *
 * Deliberately not part of the dashboard. An offer is the only screen in the
 * artisan's app with a deadline on it, and everything else — earnings, the
 * availability toggle, verification — is noise while that clock is running.
 *
 * The client's address and photographs of the inside of their home are shown
 * *before* acceptance, which is necessary (you cannot price what you cannot
 * see) and is only acceptable because RLS scopes this to the artisan holding a
 * live offer on this specific job. The moment the offer lapses, the policy
 * stops returning it.
 */
export default async function OfferPage({ params }: PageProps<"/provider/offers/[offerId]">) {
  const { offerId } = await params;

  const [offer, provider] = await Promise.all([getOffer(offerId), getMyProvider()]);

  if (!offer || !offer.job) notFound();

  // Somebody else's offer, or an account that is not an artisan. RLS would
  // already have returned nothing; this is the belt to that braces.
  if (!provider || offer.provider_id !== provider.profile_id) notFound();

  // Already answered. The decision screen has nothing left to decide, and the
  // job screen is where the work now lives.
  if (offer.status === "accepted") redirect(`/provider/jobs/${offer.job_id}`);

  const photoRows = await listJobPhotos(offer.job_id);
  const [photos, voiceNoteUrl] = await Promise.all([
    signJobPhotos(photoRows),
    signVoiceNote(offer.job.voice_note_path),
  ]);

  return (
    <OfferDecision
      offerId={offer.id}
      expiresAt={offer.expires_at}
      sentAt={offer.sent_at}
      distanceKm={offer.distance_km === null ? null : Number(offer.distance_km)}
      settled={offer.status !== "pending"}
      job={{
        id: offer.job.id,
        reference: offer.job.reference,
        categoryName: offer.job.category?.name ?? "Job",
        categoryIcon: offer.job.category?.icon ?? "wrench",
        description: offer.job.description,
        landmark: offer.job.landmark,
        addressText: offer.job.address_text,
        ghanapostCode: offer.job.ghanapost_code,
      }}
      photos={photos}
      voiceNoteUrl={voiceNoteUrl}
    />
  );
}
