"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageOff, MapPin, Mic, Navigation, X } from "lucide-react";
import { toast } from "sonner";

import { callAction } from "@/lib/action-call";

import { respondToOfferAction } from "@/app/(app)/provider/actions";
import { Button } from "@/components/ui/button";
import { SlideToConfirm } from "@/components/ui/slide-to-confirm";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { OfferCountdown } from "@/components/provider/offer-countdown";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { SignedPhoto } from "@/lib/jobs/queries";

/**
 * The offer, and the two buttons.
 *
 * Built to PLAN.md §11's commitment that the artisan side runs on large icons,
 * photographs and colour-coded states rather than paragraphs. The person
 * reading this is standing up, one-handed, possibly on a building site, and has
 * two minutes.
 *
 * Three decisions worth defending:
 *
 *  • **The photographs come before the description.** An artisan sizes a job by
 *    looking at it. A wall of text above the only useful evidence is the most
 *    common way this screen gets built and the most common way it gets skimmed.
 *
 *  • **Accept is not a confirmation flow.** There is a clock running; an "are
 *    you sure?" step spends the artisan's scarcest resource protecting them
 *    from a decision they came here to make. Passing is likewise one tap — it
 *    costs them nothing and the job simply moves on.
 *
 *  • **Expiry is handled in place, not by a redirect.** Losing the race is
 *    normal and frequent, so it reads as information rather than as an error:
 *    the screen settles into a quiet "this went to another artisan" instead of
 *    throwing the artisan back to a dashboard wondering what happened.
 */

interface OfferJob {
  id: string;
  reference: string;
  categoryName: string;
  categoryIcon: string;
  description: string | null;
  landmark: string | null;
  addressText: string | null;
  ghanapostCode: string | null;
}

export function OfferDecision({
  offerId,
  expiresAt,
  sentAt,
  distanceKm,
  settled,
  job,
  photos,
  voiceNoteUrl,
}: {
  offerId: string;
  expiresAt: string;
  sentAt: string;
  distanceKm: number | null;
  /** The offer was already declined, expired or superseded when the page loaded. */
  settled: boolean;
  job: OfferJob;
  photos: SignedPhoto[];
  voiceNoteUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [closed, setClosed] = React.useState(settled);
  const [choice, setChoice] = React.useState<"accept" | "pass" | null>(null);

  const respond = (accept: boolean) => {
    if (pending || closed) return;
    setChoice(accept ? "accept" : "pass");

    startTransition(async () => {
      const result = await callAction(() => respondToOfferAction(offerId, accept));

      if (!result.ok) {
        setChoice(null);
        // The common failure is losing the race, and `respond_to_offer` says so
        // in a sentence. Surfacing it verbatim beats inventing a generic one.
        toast.error(result.error ?? "Could not send your answer.");
        setClosed(true);
        router.refresh();
        return;
      }

      if (accept) {
        toast.success("Job accepted. Build your price.");
        router.push(`/provider/jobs/${job.id}`);
      } else {
        toast("Passed. We'll offer it to the next artisan.");
        router.push("/provider");
      }
    });
  };

  const onExpire = React.useCallback(() => setClosed(true), []);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* The header carries the three facts that decide it: what, how far, how
          long. Everything else on the screen is supporting evidence. */}
      <header
        className={cn(
          "flex items-center gap-4 rounded-card border p-5 shadow-sm",
          closed ? "border-ink-200 bg-ink-0" : "border-brand-200 bg-brand-50",
        )}
      >
        <span
          className={cn(
            "grid size-14 shrink-0 place-items-center rounded-card",
            closed ? "bg-ink-100 text-ink-500" : "bg-brand-600 text-white",
          )}
        >
          <CategoryIcon name={job.categoryIcon} className="size-7" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-medium tracking-wide text-ink-500 uppercase">
            {closed ? "Offer closed" : "New job offer"}
          </p>
          <h1 className="truncate text-xl leading-tight font-semibold text-ink-900">
            {job.categoryName}
          </h1>
          {distanceKm !== null && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-700">
              <Navigation className="size-3.5 text-ink-400" aria-hidden />
              <span className="tabular font-mono font-medium">{distanceKm.toFixed(1)} km</span>
              away
            </p>
          )}
        </div>

        {!closed && (
          <OfferCountdown
            key={offerId}
            expiresAt={expiresAt}
            sentAt={sentAt}
            onExpire={onExpire}
            className="size-24 sm:size-28"
          />
        )}
      </header>

      {closed ? (
        <div className="animate-fade-up space-y-4 rounded-card border border-ink-200 bg-ink-0 p-6 text-center shadow-sm">
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-ink-900">This one went to someone else</p>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-ink-600">
              Offers run for two minutes and then move on. Staying online is the single biggest
              thing that puts the next one in front of you.
            </p>
          </div>
          <Link href="/provider" className={cn(buttonVariants({ size: "lg" }), "mx-auto")}>
            Back to my work
          </Link>
        </div>
      ) : (
        <>
          {/* Evidence first. An artisan prices by looking. */}
          {photos.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-800">What they sent</h2>
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {photos.map((photo) => (
                  <li
                    key={photo.id}
                    className="relative aspect-[4/3] overflow-hidden rounded-card border border-ink-200 bg-ink-100"
                  >
                    {photo.url ? (
                      <Image
                        src={photo.url}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 50vw, 220px"
                        className="object-cover"
                        unoptimized /* signed URL, expires — no point caching a derivative */
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

          {voiceNoteUrl && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-800">
                <Mic className="size-3.5 text-ink-500" aria-hidden />
                They recorded a message
              </h2>
              {/* The native player, deliberately. It is the one control every
                  Android build already knows how to render, and this screen is
                  not the place to discover a custom player's edge cases. */}
              <audio src={voiceNoteUrl} controls preload="none" className="w-full" />
            </section>
          )}

          {job.description && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-800">The problem</h2>
              <p className="rounded-card border border-ink-200 bg-ink-0 p-4 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-ink-800 shadow-xs">
                {job.description}
              </p>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink-800">Where</h2>
            <div className="flex items-start gap-2.5 rounded-card border border-ink-200 bg-ink-0 p-4 shadow-xs">
              <MapPin className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />
              <div className="min-w-0 space-y-0.5">
                {/* The landmark leads. It is how the artisan will actually find
                    the place, which is why Phase 1 made it mandatory. */}
                {job.landmark && (
                  <p className="text-[0.9375rem] leading-snug font-medium text-ink-900">
                    {job.landmark}
                  </p>
                )}
                {job.addressText && <p className="text-sm text-ink-600">{job.addressText}</p>}
                {job.ghanapostCode && (
                  <p className="tabular font-mono text-xs text-ink-500">{job.ghanapostCode}</p>
                )}
                <p className="pt-1 text-xs text-ink-500">
                  The exact pin is shared once you accept.
                </p>
              </div>
            </div>
          </section>

          {/* Sticky, because the evidence above is scrollable and a decision
              control you have to hunt for is a decision that times out. */}
          <div className="sticky bottom-0 -mx-5 space-y-3 border-t border-hairline bg-white/95 px-5 py-4 backdrop-blur-md sm:mx-0 sm:rounded-[1.5rem] sm:border sm:px-4">
            {/**
             * Accept is a slide, not a tap — and the asymmetry is the point.
             *
             * Accepting is the consequential half of this screen: it locks the
             * artisan to a job, and abandoning one afterwards costs them a
             * cancellation against their reliability score (migration 0018).
             * A thumb resting on a phone in a trotro should not be able to take
             * a job by brushing the glass, so accepting asks for a deliberate
             * gesture that a stray touch cannot produce.
             *
             * Passing stays a plain button. Making both deliberate would be
             * ceremony for its own sake: declining costs nothing, the offer
             * simply moves to the next artisan, and the clock is running.
             */}
            <SlideToConfirm
              label="Slide to accept"
              confirmingLabel="Accepting…"
              confirmedLabel="Accepted"
              onConfirm={() => respond(true)}
              pending={pending && choice === "accept"}
              disabled={pending}
              tone="success"
            />

            <Button
              type="button"
              variant="navyOutline"
              size="lg"
              shape="pill"
              block
              onClick={() => respond(false)}
              loading={pending && choice === "pass"}
              disabled={pending}
            >
              <X />
              Pass on this one
            </Button>
          </div>

          <p className="text-center text-2xs leading-relaxed text-copy-muted">
            Accepting does not commit you to a price. You build the quote next, and the client
            has to approve it before you travel.
          </p>
        </>
      )}
    </div>
  );
}
