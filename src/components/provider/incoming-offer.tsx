"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Navigation } from "lucide-react";

import { CategoryIcon } from "@/components/marketplace/category-icon";
import { OfferCountdown } from "@/components/provider/offer-countdown";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * "You have a job waiting."
 *
 * The matcher gives an artisan 120 seconds, and an artisan who has the
 * dashboard open rather than the offer screen must not spend forty of them
 * finding out. So this does two jobs:
 *
 *  • **When there is an offer**, it is the loudest thing on the screen, carries
 *    its own countdown, and is one tap from the decision.
 *  • **When there is not**, and the artisan is online, it polls quietly so an
 *    offer *arrives* rather than waiting to be discovered on a manual refresh.
 *
 * The poll is deliberately faster than the client's matching screen. The client
 * is waiting; the artisan is on a clock, and ten seconds of a two-minute window
 * is eight percent of their time to decide.
 *
 * Polling stops entirely when the artisan is offline — there is nothing to
 * receive — and when the tab is hidden, which on a phone is most of the time.
 */

const POLL_MS = 6_000;

export interface IncomingOfferProps {
  offer: {
    id: string;
    expiresAt: string;
    sentAt: string;
    distanceKm: number | null;
    categoryName: string;
    categoryIcon: string;
    landmark: string | null;
  } | null;
  /** Only poll for work when the artisan is actually available for it. */
  listening: boolean;
}

export function IncomingOffer({ offer, listening }: IncomingOfferProps) {
  const router = useRouter();

  React.useEffect(() => {
    // An offer already on screen carries its own expiry; polling behind it
    // would only replace the countdown mid-tick.
    if (!listening || offer) return;

    function poll() {
      if (document.visibilityState === "visible") router.refresh();
    }

    const timer = window.setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [router, listening, offer]);

  if (!offer) return null;

  return (
    <Link
      href={`/provider/offers/${offer.id}`}
      className={cn(
        "group block overflow-hidden rounded-card border-2 border-brand-600 bg-brand-50 shadow-md",
        // Entering, so ease-out. It arrives on a poll while the artisan is
        // looking at a static screen — appearing without transition would read
        // as a rendering glitch rather than as news.
        "animate-fade-up",
        "transition-[box-shadow,transform] duration-[var(--duration-fast)] ease-out-strong",
        "hover:shadow-lg active:scale-[0.995]",
      )}
    >
      <div className="flex items-center gap-4 p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-card bg-brand-600 text-white">
          <CategoryIcon name={offer.categoryIcon} className="size-6" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-semibold tracking-wide text-brand-700 uppercase">
            New job offer
          </p>
          <p className="truncate text-[1.0625rem] leading-tight font-semibold text-ink-900">
            {offer.categoryName}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-ink-700">
            {offer.distanceKm !== null && (
              <>
                <Navigation className="size-3.5 shrink-0 text-ink-400" aria-hidden />
                <span className="tabular font-mono font-medium">
                  {offer.distanceKm.toFixed(1)} km
                </span>
              </>
            )}
            {offer.landmark && <span className="truncate text-ink-500">· {offer.landmark}</span>}
          </p>
        </div>

        {/* Keyed by offer id: the countdown samples the wall clock once at
            mount, so a different offer has to be a different mount. */}
        <OfferCountdown
          key={offer.id}
          expiresAt={offer.expiresAt}
          sentAt={offer.sentAt}
          className="size-20 shrink-0"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-brand-200 bg-brand-100/60 px-4 py-2.5">
        <span className="text-sm font-medium text-brand-900">
          Open it before the time runs out
        </span>
        <span className={cn(buttonVariants({ size: "sm" }), "pointer-events-none")}>
          View job
          <ArrowRight className="transition-transform duration-[var(--duration-fast)] ease-out-strong group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
