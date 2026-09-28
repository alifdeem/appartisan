import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Clock, Wallet } from "lucide-react";

import { CategoryIcon } from "@/components/marketplace/category-icon";
import { FieldLabel } from "@/components/mobile/field-label";
import { formatCedis } from "@/lib/money";
import { getMyProvider, listMyPayouts, summarisePayouts } from "@/lib/providers/queries";
import { formatPhoneForDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { PayoutWithJob } from "@/lib/providers/queries";

export const metadata: Metadata = { title: "Earnings" };

/**
 * What the artisan has been paid.
 *
 * **Why this is a tab and not a panel on the dashboard.** The whole pitch to an
 * artisan on this platform is that they get paid properly and can see it.
 * Burying that a level down would bury the pitch. It is also the screen someone
 * opens when they are anxious, which is a good reason for it to be calm,
 * specific, and free of anything it cannot prove.
 *
 * **Only settled money is "earned".** The headline is `paid` payouts and
 * nothing else. Counting `pending` would mean the total *drops* when a transfer
 * fails — the single worst thing an earnings screen can do to someone's trust.
 * Money in flight gets its own quiet line, and a failed transfer gets a loud
 * one, because that is the case where the artisan has to do something.
 *
 * **No chart.** A bar chart of weekly earnings is the obvious move and it would
 * be decoration here: at this volume it plots six bars from six rows the list
 * below already shows, and it invites reading a trend into a sample too small
 * to have one. It earns its place when there are months of history, not weeks.
 */
export default async function EarningsPage() {
  const provider = await getMyProvider();
  if (!provider) redirect("/");

  const payouts = await listMyPayouts();
  const summary = summarisePayouts(payouts);

  const approved = provider.verification_status === "approved";

  return (
    <div className="space-y-7 pb-28">
      <header className="space-y-1.5">
        <h1 className="font-space text-title font-bold text-navy-900">Earnings</h1>
        <p className="text-note text-copy-muted">
          {summary.settledCount === 0
            ? "Nothing settled yet."
            : `${summary.settledCount} payout${summary.settledCount === 1 ? "" : "s"} settled to your Mobile Money.`}
        </p>
      </header>

      {/* ---- The headline ------------------------------------------------ */}
      <section className="rounded-[1.75rem] bg-linear-to-b from-navy-800 to-navy-900 p-6 shadow-[var(--shadow-glow-navy-lg)]">
        <FieldLabel className="text-white/60">This week</FieldLabel>
        {/* Mono and tabular, like every quantity in this app — and it matters
            more here than anywhere: this is the number people compare week to
            week, and proportional digits make two totals of the same length
            look different lengths. */}
        <p className="tabular mt-1.5 font-mono text-title-lg leading-none font-bold text-white">
          {formatCedis(summary.thisWeek)}
        </p>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/15 pt-4">
          <div>
            <p className="text-2xs tracking-[0.07em] text-white/50 uppercase">All time</p>
            <p className="tabular mt-1 font-mono text-lede font-bold text-white">
              {formatCedis(summary.allTime)}
            </p>
          </div>

          {summary.onTheWay > 0 && (
            <div className="text-right">
              <p className="inline-flex items-center gap-1 text-2xs tracking-[0.07em] text-white/50 uppercase">
                <Clock className="size-3" aria-hidden />
                On the way
              </p>
              <p className="tabular mt-1 font-mono text-lede font-bold text-white/85">
                {formatCedis(summary.onTheWay)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* A failed transfer is the one case where the artisan has to act, so it
          is the one thing on this screen allowed to shout. */}
      {summary.failed > 0 && (
        <section className="flex items-start gap-3 rounded-[1.25rem] border border-danger-500/30 bg-danger-50 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-note font-semibold text-danger-700">
              {formatCedis(summary.failed)} could not be sent
            </p>
            <p className="mt-1 text-note leading-relaxed text-danger-700/85">
              Check the Mobile Money number on your account is right and still active. We retry
              failed transfers once your details are corrected.
            </p>
            <Link
              href="/provider/account"
              className="tap mt-2 inline-flex items-center gap-1 text-note font-semibold text-danger-700 underline underline-offset-4"
            >
              Check payout details
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </section>
      )}

      {/* ---- Where it goes ----------------------------------------------- */}
      <section className="flex items-center gap-3.5 rounded-[1.25rem] border border-hairline bg-white p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-azure-50 text-navy-800">
          <Wallet className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <FieldLabel>Paid into</FieldLabel>
          {provider.momo_number ? (
            <p className="tabular mt-0.5 truncate font-mono text-ui font-semibold text-navy-900">
              {formatPhoneForDisplay(provider.momo_number)}
              {provider.momo_network && (
                <span className="ml-2 font-sans text-note font-normal text-copy-muted uppercase">
                  {provider.momo_network}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-note text-copy-muted">
              No Mobile Money number yet — you cannot be paid without one.
            </p>
          )}
        </div>
        <Link
          href="/provider/account"
          className="tap shrink-0 text-note font-semibold text-azure-600 underline-offset-4 hover:underline"
        >
          Change
        </Link>
      </section>

      {/* ---- The ledger --------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="font-space text-lede font-bold text-navy-900">Payouts</h2>

        {payouts.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-hairline bg-azure-50/50 px-5 py-12 text-center">
            <p className="font-space text-note font-bold text-navy-900">No payouts yet</p>
            <p className="mx-auto mt-1.5 max-w-xs text-note leading-relaxed text-copy-muted">
              {approved
                ? "Finish a job and your share lands here the moment the client signs it off."
                : "Once you are verified and start completing jobs, every payout shows up here."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {payouts.map((payout) => (
              <li key={payout.id}>
                <PayoutRow payout={payout} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * One payout.
 *
 * A row, not a card. Forty cards is a wall; forty rows separated by a hairline
 * is a ledger, which is what this is and what people already know how to read.
 *
 * The amount is the only bold thing, and it is aligned right so a column of
 * them can be scanned down without reading any of the words beside them.
 */
function PayoutRow({ payout }: { payout: PayoutWithJob }) {
  const settled = payout.status === "paid";
  const failed = payout.status === "failed";

  const when = new Date(payout.settled_at ?? payout.initiated_at);
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(when);

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full",
          failed ? "bg-danger-50 text-danger-600" : "bg-azure-50 text-navy-800",
        )}
      >
        <CategoryIcon name={payout.job?.category?.icon ?? "wrench"} className="size-[1.125rem]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-ui font-semibold text-navy-900">
          {payout.job?.category?.name ?? "Job"}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-2xs text-copy-muted">
          <span className="tabular font-mono">{payout.job?.reference ?? "-"}</span>
          <span>{date}</span>
          {!settled && (
            <span
              className={cn(
                "rounded-full px-1.5 py-px font-semibold",
                failed ? "bg-danger-50 text-danger-700" : "bg-azure-50 text-navy-800",
              )}
            >
              {failed ? "Failed" : "On the way"}
            </span>
          )}
        </span>
      </span>

      <span
        className={cn(
          "tabular shrink-0 self-center font-mono text-ui font-bold",
          failed ? "text-danger-600 line-through" : settled ? "text-navy-900" : "text-copy-muted",
        )}
      >
        {formatCedis(Number(payout.amount))}
      </span>
    </>
  );

  // Linked only when there is a job to link to. A payout whose job has been
  // hard-deleted would otherwise be a row that looks tappable and 404s.
  if (!payout.job) {
    return <div className="flex min-h-16 items-start gap-3.5 py-3.5">{body}</div>;
  }

  return (
    <Link
      href={`/provider/jobs/${payout.job.id}`}
      className="-mx-2 flex min-h-16 items-start gap-3.5 rounded-[1rem] px-2 py-3.5 transition-colors duration-[var(--duration-fast)] hover:bg-azure-50/60"
    >
      {body}
    </Link>
  );
}
