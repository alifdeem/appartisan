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
 * Amber marks the two figures that are actual money changing hands, and nothing
 * else, per DESIGN.md §3.
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
        "overflow-hidden rounded-card border border-ink-200 bg-ink-25 font-mono",
        className,
      )}
    >
      {/* The two headline figures, side by side and the same size. Whichever is
          made larger becomes the "real" number in the artisan's head, and both
          of them are real. */}
      <div className="grid grid-cols-2 divide-x divide-ink-200 border-b border-ink-200">
        <div className="px-4 py-3">
          <p className="text-[0.625rem] font-semibold tracking-[0.08em] text-ink-500 uppercase">
            You receive
          </p>
          <p className="tabular mt-1 text-lg font-semibold text-accent-900">
            {formatAmount(q.providerPayout)}
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-ink-500">after sign-off</p>
        </div>

        <div className="px-4 py-3">
          <p className="text-[0.625rem] font-semibold tracking-[0.08em] text-ink-500 uppercase">
            Client pays
          </p>
          <p className="tabular mt-1 text-lg font-semibold text-accent-900">
            {formatAmount(q.grandTotal)}
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-ink-500">across two payments</p>
        </div>
      </div>

      <dl className="divide-y divide-ink-100 text-[0.8125rem]">
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
    <div className="flex items-baseline gap-3 px-4 py-2">
      <dt className={cn("min-w-0 flex-1", muted ? "text-ink-500" : "text-ink-700")}>
        {label}
        {note && <span className="ml-1.5 text-[0.6875rem] text-ink-400">{note}</span>}
      </dt>
      <dd className={cn("tabular shrink-0", muted ? "text-ink-600" : "text-ink-900")}>
        {formatAmount(value)}
      </dd>
    </div>
  );
}
