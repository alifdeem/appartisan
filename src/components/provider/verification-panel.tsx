import Link from "next/link";
import { BadgeCheck, Clock, FileText, PauseCircle, RotateCcw, ShieldAlert } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { applicationProgress } from "@/lib/providers/application";
import { cn, timeAgo } from "@/lib/utils";
import type { ProviderDocType, ProviderRow, VerificationStatus } from "@/lib/supabase/types";
import type { ReviewWithAdmin } from "@/lib/providers/queries";

/**
 * Where an artisan stands, and what to do about it.
 *
 * The five verification states are not five shades of the same message. Two of
 * them are work the artisan has to do, two are waiting, and one is a door that
 * has closed — so this is five distinct panels rather than one panel with a
 * colour prop.
 *
 * The decision that matters most is on `rejected`: **the admin's notes are
 * shown to the artisan, verbatim.** It is tempting to keep them internal, and
 * it is a mistake for the same reason PLAN.md §8 gives for showing reliability
 * scores — hiding the reason and then expecting somebody to fix it is how a
 * supply-constrained marketplace loses the people it cannot afford to lose. It
 * is also why `review_provider_application()` refuses a rejection with no note:
 * an empty box here would be worse than no box.
 */

const TONE: Record<
  VerificationStatus,
  { icon: typeof BadgeCheck; badge: "neutral" | "warning" | "success" | "danger" | "info"; ring: string; wash: string; mark: string }
> = {
  unsubmitted: {
    icon: FileText,
    badge: "neutral",
    ring: "border-ink-200",
    wash: "bg-ink-0",
    mark: "bg-ink-100 text-ink-600",
  },
  pending: {
    icon: Clock,
    badge: "info",
    ring: "border-info-500/30",
    wash: "bg-info-50",
    mark: "bg-info-500/15 text-info-700",
  },
  approved: {
    icon: BadgeCheck,
    badge: "success",
    ring: "border-success-500/35",
    wash: "bg-success-50",
    mark: "bg-success-500/15 text-success-700",
  },
  rejected: {
    icon: ShieldAlert,
    badge: "danger",
    ring: "border-danger-500/35",
    wash: "bg-danger-50",
    mark: "bg-danger-500/12 text-danger-700",
  },
  suspended: {
    icon: PauseCircle,
    badge: "danger",
    ring: "border-danger-500/35",
    wash: "bg-danger-50",
    mark: "bg-danger-500/12 text-danger-700",
  },
};

export function VerificationPanel({
  provider,
  tradeCount,
  docTypes,
  latestReview,
}: {
  provider: ProviderRow;
  tradeCount: number;
  docTypes: ProviderDocType[];
  /** The most recent decision, if there has ever been one. */
  latestReview: ReviewWithAdmin | null;
}) {
  const status = provider.verification_status;
  const tone = TONE[status];
  const Icon = tone.icon;

  const progress = applicationProgress({ provider, tradeCount, docTypes });
  const started = progress > 0;

  return (
    <section className={cn("overflow-hidden rounded-card border shadow-sm", tone.ring, tone.wash)}>
      <div className="flex flex-wrap items-start gap-4 p-5">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", tone.mark)}>
          <Icon className="size-5" aria-hidden />
        </span>

        <div className="min-w-[15rem] flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink-900">
              {status === "approved"
                ? "You're verified"
                : status === "pending"
                  ? "With our team"
                  : status === "rejected"
                    ? "Not approved yet"
                    : status === "suspended"
                      ? "Account suspended"
                      : started
                        ? "Application started"
                        : "Get verified"}
            </h2>
            <Badge tone={tone.badge}>
              {status === "unsubmitted"
                ? started
                  ? "In progress"
                  : "Not started"
                : status === "pending"
                  ? "Under review"
                  : status === "approved"
                    ? "Verified"
                    : status === "rejected"
                      ? "Needs changes"
                      : "Suspended"}
            </Badge>
          </div>

          <p className="max-w-prose text-sm leading-relaxed text-ink-600">
            {status === "approved" &&
              "Clients can see your Ghana Card and phone are verified. Go online to start receiving jobs."}
            {status === "pending" && (
              <>
                Our team is checking your documents and will call you to confirm a few details.
                {provider.application_submitted_at && (
                  <> Sent {timeAgo(provider.application_submitted_at)}.</>
                )}
              </>
            )}
            {status === "rejected" &&
              "Something in your application needs fixing. Sort it out below and send it back — nothing you filled in has been lost."}
            {status === "suspended" &&
              "You will not receive job offers while your account is suspended. Our team will be in touch."}
            {status === "unsubmitted" &&
              (started
                ? "Pick up where you left off. Everything you have filled in is saved."
                : "Verified artisans get the jobs. It takes about ten minutes and you need your Ghana Card.")}
          </p>

          {/* The reason, in the admin's own words. See the note above. */}
          {(status === "rejected" || status === "suspended") && latestReview?.call_notes && (
            <blockquote className="mt-2.5 rounded-field border-l-2 border-danger-500/50 bg-ink-0/70 py-2 pl-3 text-sm leading-relaxed text-ink-800">
              {latestReview.call_notes}
              <footer className="mt-1 text-xs text-ink-500">
                ArtisanGH verification team · {timeAgo(latestReview.reviewed_at)}
              </footer>
            </blockquote>
          )}
        </div>

        {(status === "unsubmitted" || status === "rejected") && (
          <Link
            href="/provider/apply"
            className={cn(buttonVariants({ size: "md" }), "shrink-0")}
          >
            {status === "rejected" ? (
              <>
                <RotateCcw />
                Fix and resend
              </>
            ) : started ? (
              "Continue"
            ) : (
              "Start verification"
            )}
          </Link>
        )}
      </div>

      {/* Only where it means something: progress through work still to do. A
          bar under "Verified" would be a bar at 100% forever. */}
      {status === "unsubmitted" && started && (
        <div className="border-t border-ink-200/70 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-200">
              <div
                className="h-full rounded-full bg-brand-600 transition-[width] duration-[var(--duration-slow)] ease-out-strong"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="tabular font-mono text-xs text-ink-500">
              {Math.round(progress * 100)}%
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
