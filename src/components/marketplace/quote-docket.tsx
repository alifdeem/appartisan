import { cn } from "@/lib/utils";
import { formatAmount, type QuoteBreakdown } from "@/lib/money";

/**
 * The quote docket.
 *
 * Second half of the product's argument: you know the price before anyone picks
 * up a tool. Every competitor in this category hides the number until late, so
 * showing it early — and showing it itemised — is the differentiator, and a
 * differentiator you can actually draw.
 *
 * It is set in mono with tabular figures because that is what makes a price
 * list read as a *document* rather than as a div. Lined-up decimal points are
 * doing most of the persuasive work here; the moment the digits stop aligning
 * it stops looking like a receipt and starts looking like a web page.
 *
 * Amber appears exactly twice — on the grand total and the deposit due — and
 * nowhere else in the entire app except money. That restraint is what makes it
 * mean something.
 *
 * Takes a real `QuoteBreakdown` from `src/lib/money.ts`, which mirrors
 * `compute_quote_totals` in migration 0002. The landing page and the Phase 1
 * booking flow render the same arithmetic.
 */

export interface QuoteLine {
  /** "Labour", "Materials", "Transport". Grouping, not a category id. */
  kind: string;
  description: string;
  amount: number;
}

export interface QuoteDocketProps {
  /**
   * What heading level the title should be. The card is a real list item on a
   * marketplace screen, where h3 is right — but it also appears illustratively
   * under the hero h1, where an h3 skips a level and an audit flags it.
   */
  headingLevel?: 2 | 3 | 4;
  lines: QuoteLine[];
  breakdown: QuoteBreakdown;
  /** Shown in the header strip. Real jobs have a reference; demos may not. */
  reference?: string;
  title?: string;
  /** Hide the deposit split where only the total matters. */
  showDeposit?: boolean;
  className?: string;
  elevated?: boolean;
}

function Row({
  label,
  detail,
  amount,
  muted = false,
}: {
  label: string;
  detail?: string;
  amount: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-2">
      <span className="w-[4.75rem] shrink-0 font-mono text-[0.6875rem] tracking-wide text-ink-500 uppercase">
        {label}
      </span>
      <span className={cn("min-w-0 flex-1 text-[0.8125rem]", muted ? "text-ink-600" : "text-ink-800")}>
        {detail}
      </span>
      <span
        className={cn(
          "shrink-0 font-mono text-[0.8125rem] tabular",
          muted ? "text-ink-600" : "text-ink-900",
        )}
      >
        {formatAmount(amount)}
      </span>
    </div>
  );
}

export function QuoteDocket({
  lines,
  breakdown,
  reference,
  title = "Quote",
  showDeposit = true,
  className,
  elevated = false,
  headingLevel = 3,
}: QuoteDocketProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section
      className={cn(
        "overflow-hidden rounded-card border border-ink-200 bg-ink-0",
        elevated ? "shadow-lg" : "shadow-sm",
        className,
      )}
      aria-label={`${title} breakdown`}
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-ink-200 bg-ink-25 px-4 py-2.5">
        <Heading className="font-mono text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-700 uppercase">
          {title}
        </Heading>
        <div className="flex items-baseline gap-2.5">
          {reference && (
            <span className="font-mono text-[0.6875rem] tabular text-ink-400">{reference}</span>
          )}
          <span className="font-mono text-[0.6875rem] tracking-wide text-ink-500 uppercase">
            GHS
          </span>
        </div>
      </header>

      <div className="divide-y divide-ink-100">
        {lines.map((line, i) => (
          <Row key={i} label={line.kind} detail={line.description} amount={line.amount} />
        ))}
      </div>

      <div className="border-t border-ink-200">
        <Row
          label="Fee"
          detail={`ArtisanGH service fee, ${breakdown.commissionPct}%`}
          amount={breakdown.serviceFee}
          muted
        />
      </div>

      {/* The total. Amber, heavier, and a size step up — the one thing on the
          docket the eye should land on first. */}
      <div className="flex items-baseline gap-3 border-t-2 border-ink-900 bg-accent-50 px-4 py-3">
        <span className="w-[4.75rem] shrink-0 font-mono text-[0.6875rem] font-semibold tracking-wide text-accent-800 uppercase">
          Total
        </span>
        <span className="min-w-0 flex-1 text-[0.8125rem] text-accent-800">
          Agreed before work starts
        </span>
        <span className="shrink-0 font-mono text-base font-semibold tabular text-accent-900">
          {formatAmount(breakdown.grandTotal)}
        </span>
      </div>

      {showDeposit && (
        <div className="divide-y divide-ink-100 border-t border-ink-200 bg-ink-25">
          <Row label="Deposit" detail="Held by ArtisanGH until sign-off" amount={breakdown.depositDue} muted />
          <Row label="Balance" detail="On completion, after you approve" amount={breakdown.balanceDue} muted />
        </div>
      )}
    </section>
  );
}
