import { computeQuote, formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The same quote, from the artisan's side.
 *
 * `QuoteDocket` is what the *client* sees. This is its counterpart, and it
 * exists because of one specific warning in PLAN.md §4:
 *
 *   "Show the artisan the client-facing total, not just their own quote. If the
 *    artisan thinks the job is GHS 400 and the client is paying GHS 448, they
 *    will have that conversation on the customer's doorstep and it will go
 *    badly. Display both numbers with the fee labelled."
 *
 * So both numbers are given equal weight and the fee between them is named in
 * full. The temptation is to bury the markup — it is the platform's only
 * revenue line and it looks better small. Burying it does not make it go away;
 * it just means the artisan discovers it from the customer.
 *
 * **"You receive" is the one figure on a navy ground.** Equal weight was the
 * old rule and it was half right: both numbers must be legible and neither may
 * be hidden, which is still true here — same size, same face, side by side. But
 * one of them is this person's income and the other is somebody else's outgoing,
 * and on a screen an artisan opens while deciding whether a job is worth taking,
 * refusing to say which is which is not neutrality. It is just unhelpful.
 *
 * The fee lines below spell out exactly what the difference is made of, which
 * is what stops the two figures reading as a discrepancy.
 */
export function QuoteSummary({
  subtotal,
  transportFee,
  commissionPct,
  className,
}: {
  subtotal: number;
  transportFee: number;
  commissionPct: number;
  className?: string;
}) {
  const q = computeQuote({ subtotal, transportFee, commissionPct });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.25rem] border border-hairline bg-white",
        className,
      )}
    >
      <div className="grid grid-cols-2">
        <div className="relative isolate overflow-hidden bg-linear-to-br from-navy-700 via-navy-800 to-navy-900 px-4 py-3.5">
          <span
            aria-hidden
            className="absolute -top-12 -right-6 -z-10 size-28 rounded-full bg-azure-400/30 blur-2xl"
          />
          <p className="text-2xs font-semibold tracking-[0.07em] text-white/60 uppercase">
            You receive
          </p>
          <p className="tabular mt-1.5 font-mono text-title-sm leading-none font-bold text-white">
            {formatAmount(q.providerPayout)}
          </p>
          <p className="mt-1.5 text-2xs text-white/60">after sign-off</p>
        </div>

        <div className="bg-canvas px-4 py-3.5">
          <p className="text-2xs font-semibold tracking-[0.07em] text-copy-muted uppercase">
            Client pays
          </p>
          <p className="tabular mt-1.5 font-mono text-title-sm leading-none font-bold text-navy-900">
            {formatAmount(q.grandTotal)}
          </p>
          <p className="mt-1.5 text-2xs text-copy-muted">across two payments</p>
        </div>
      </div>

      <dl className="divide-y divide-hairline border-t border-hairline text-note">
        <Line label="Your price" value={q.subtotal} />
        <Line
          label={`ArtisanGH fee, ${commissionPct}%`}
          value={q.serviceFee}
          muted
          note="added on top — not taken from you"
        />
        <Line label="Transport" value={q.transportFee} note="paid to you in full" />
      </dl>
    </div>
  );
}

function Line({
  label,
  value,
  note,
  muted = false,
}: {
  label: string;
  value: number;
  note?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      {/* The note sits under the label rather than after it. Inline, "added on
          top — not taken from you" wrapped to a second line and left the
          figure stranded on the first, which on the one row an artisan is
          most suspicious of is the worst place to look untidy. */}
      <dt className={cn("min-w-0 flex-1", muted ? "text-copy-muted" : "text-navy-900")}>
        <span className="block">{label}</span>
        {note && <span className="mt-0.5 block text-2xs text-copy-muted">{note}</span>}
      </dt>
      <dd
        className={cn(
          "tabular shrink-0 font-mono",
          muted ? "text-copy-muted" : "font-semibold text-navy-900",
        )}
      >
        {formatAmount(value)}
      </dd>
    </div>
  );
}
