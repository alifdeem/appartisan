import Image from "next/image";
import { BadgeCheck, MapPin, Phone, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProviderAvailability, VerificationStatus } from "@/lib/supabase/types";

/**
 * The verified artisan card.
 *
 * This is the product's whole argument in one object, so it is worth saying why
 * it looks the way it does.
 *
 * Every competitor in this category *asserts* trust in prose — Urban Company's
 * homepage says "Trained professionals" and shows nothing. Airtasker is the only
 * one that shows it, as a row of discrete badges on the profile card, and that
 * is the pattern borrowed here: three separate claims, each independently
 * checkable, rather than one vague "verified" stamp.
 *
 * Two deliberate choices in the figures:
 *  • The rating is a decimal (4.9), not a row of stars. Stars are decoration and
 *    every marketplace has them; a number with a denominator next to it reads as
 *    something that was actually measured.
 *  • Jobs completed is a hard count. "128 jobs" is a claim that could be wrong,
 *    which is exactly why it is persuasive.
 *
 * Props mirror the `providers` + `profiles` row shapes so Phase 1 can hand this
 * a real query result with no adapter in between. It is not a marketing mock —
 * the landing page renders the same component the app will.
 */

export interface ArtisanCardProps {
  /**
   * What heading level the title should be. The card is a real list item on a
   * marketplace screen, where h3 is right — but it also appears illustratively
   * under the hero h1, where an h3 skips a level and an audit flags it.
   */
  headingLevel?: 2 | 3 | 4;
  name: string;
  trade: string;
  /** Falls back to a hatched slot until the photograph exists. */
  avatarUrl?: string | null;
  verification: VerificationStatus;
  availability?: ProviderAvailability;
  ratingAvg: number;
  ratingCount: number;
  jobsCompleted: number;
  /** Neighbourhood, not a full address — this is shown before booking. */
  baseCity?: string | null;
  distanceKm?: number | null;
  className?: string;
  /** Lifts the card off the page. Used where it is the hero object. */
  elevated?: boolean;
  /** Tells Next to prioritise the avatar. Only for above-the-fold instances. */
  priority?: boolean;
}

function Claim({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-[0.8125rem] leading-none text-copy">
      <Icon className="size-3.5 shrink-0 text-navy-800" aria-hidden />
      {label}
    </li>
  );
}

export function ArtisanCard({
  name,
  trade,
  avatarUrl,
  verification,
  availability = "offline",
  ratingAvg,
  ratingCount,
  jobsCompleted,
  baseCity,
  distanceKm,
  className,
  elevated = false,
  headingLevel = 3,
  priority = false,
}: ArtisanCardProps) {
  const Heading = `h${headingLevel}` as const;

  const isApproved = verification === "approved";
  const isOnline = availability === "online";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-card border border-hairline bg-white",
        elevated ? "shadow-lg" : "shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3.5 p-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-[0.75rem]">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
              priority={priority}
            />
          ) : (
            <div className="img-slot size-full" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Heading className="truncate text-[1.0625rem] leading-tight font-semibold text-navy-900">
                {name}
              </Heading>
              <p className="mt-0.5 truncate text-sm text-copy-muted">
                {trade}
                {baseCity && <span className="text-copy-muted"> · {baseCity}</span>}
              </p>
            </div>

            {isOnline && (
              // Availability is a live fact, so it gets motion. Nothing else on
              // this card moves — one moving thing means it reads as a status
              // light rather than as decoration.
              <span className="mt-1 flex shrink-0 items-center gap-1.5 text-[0.75rem] font-medium text-success-700">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-success-500" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-success-500" />
                </span>
                Online
              </span>
            )}
          </div>

          {isApproved && (
            <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
              <Claim icon={ShieldCheck} label="Ghana Card" />
              <Claim icon={Phone} label="Phone" />
              <Claim icon={BadgeCheck} label="Paid through ArtisanGH" />
            </ul>
          )}
        </div>
      </div>

      {/* The measured figures, set in mono so the digits line up between cards
          in a list. A rating that jitters column-to-column reads as sloppy. */}
      <dl className="flex items-stretch border-t border-hairline bg-canvas text-navy-900">
        <div className="flex-1 px-4 py-2.5">
          <dt className="text-[0.6875rem] font-medium tracking-wide text-copy-muted uppercase">
            Rating
          </dt>
          <dd className="mt-0.5 font-mono text-sm tabular">
            {ratingCount > 0 ? (
              <>
                {ratingAvg.toFixed(1)}
                <span className="text-copy-muted"> / {ratingCount}</span>
              </>
            ) : (
              <span className="text-copy-muted">New</span>
            )}
          </dd>
        </div>

        <div className="flex-1 border-l border-hairline px-4 py-2.5">
          <dt className="text-[0.6875rem] font-medium tracking-wide text-copy-muted uppercase">
            Jobs
          </dt>
          <dd className="mt-0.5 font-mono text-sm tabular">{jobsCompleted}</dd>
        </div>

        {distanceKm != null && (
          <div className="flex-1 border-l border-hairline px-4 py-2.5">
            <dt className="text-[0.6875rem] font-medium tracking-wide text-copy-muted uppercase">
              Away
            </dt>
            <dd className="mt-0.5 flex items-center gap-1 font-mono text-sm tabular">
              <MapPin className="size-3.5 text-copy-muted" aria-hidden />
              {distanceKm.toFixed(1)} km
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}
