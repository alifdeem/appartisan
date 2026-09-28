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
 * Takes a real `QuoteBreakdown` from `src/lib/money.ts`, which mirrors
 * `compute_quote_totals` in migration 0002. The landing page and the booking
 * flow render the same arithmetic.
 *
 * ---
 *
 * **Two tones, and why this one component has a prop where nothing else does.**
 *
 * The docket appears in exactly two places: twice on the marketing landing page,
 * which is still the original warm `ink` palette, and on the client's job
 * screen, which is now navy and azure. It is the only object in the app that
 * straddles the redesign boundary, because it is the only one that is an
 * argument on one page and a record on the other.
 *
 * `warm` is the default so the landing page does not move. `cool` exists
 * because on the job screen the docket sits directly above the navy payment
 * panel, and a warm cream document next to it reads as a screenshot from
 * another app.
 *
 * **In `cool`, the total band is navy rather than amber.** The app's long
 * standing rule is that amber means money and nothing else, and on the warm
 * screens it still does. The redesign spends navy on money instead — the
 * artisan's earnings hero, the deposit panel, this total — so within a cool
 * screen the rule holds in a different colour. What would break it is showing
 * both on one screen, which is precisely what this prop prevents.
 */

export interface QuoteLine {
  /** "Labour", "Materials", "Transport". Grouping, not a category id. */
  kind: string;
  description: string;
  amount: number;
}

type Tone = "warm" | "cool";

const TONES = {
  warm: {
    shell: "border-hairline bg-white",
    header: "border-hairline bg-canvas",
    headerText: "text-copy",
    unit: "text-copy-muted",
    reference: "text-copy-muted",
    divide: "divide-azure-50",
    rule: "border-hairline",
    label: "text-copy-muted",
    detail: "text-navy-900",
    detailMuted: "text-copy-muted",
    amount: "text-navy-900",
    amountMuted: "text-copy-muted",
    totalBand: "border-t-2 border-navy-900 bg-navy-50",
    totalLabel: "text-navy-800",
    totalDetail: "text-navy-800",
    totalAmount: "text-navy-900",
    splitBand: "border-hairline bg-canvas",
  },
  cool: {
    shell: "border-hairline bg-white",
    header: "border-hairline bg-canvas",
    headerText: "text-navy-900",
    unit: "text-copy-muted",
    reference: "text-copy-muted",
    divide: "divide-hairline",
    rule: "border-hairline",
    label: "text-copy-muted",
    detail: "text-navy-900",
    detailMuted: "text-copy-muted",
    amount: "text-navy-900",
    amountMuted: "text-copy-muted",
    totalBand: "bg-linear-to-br from-navy-700 via-navy-800 to-navy-900",
    totalLabel: "text-white/60",
    totalDetail: "text-white/75",
    totalAmount: "text-white",
    splitBand: "border-hairline bg-canvas",
  },
} satisfies Record<Tone, Record<string, string>>;

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
  tone?: Tone;
}

function Row({
  label,
  detail,
  amount,
  muted = false,
  t,
}: {
  label: string;
  detail?: string;
  amount: number;
  muted?: boolean;
  t: (typeof TONES)[Tone];
}) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-2">
      <span className={cn("w-[4.75rem] shrink-0 font-mono text-2xs tracking-wide uppercase", t.label)}>
        {label}
      </span>
      <span className={cn("min-w-0 flex-1 text-note", muted ? t.detailMuted : t.detail)}>
        {detail}
      </span>
      <span
        className={cn("tabular shrink-0 font-mono text-note", muted ? t.amountMuted : t.amount)}
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
  tone = "warm",
}: QuoteDocketProps) {
  const Heading = `h${headingLevel}` as const;
  const t = TONES[tone];
  const cool = tone === "cool";

  return (
    <section
      className={cn(
        "overflow-hidden border",
        cool ? "rounded-[1.25rem]" : "rounded-card",
        t.shell,
        elevated
          ? cool
            ? "shadow-[var(--shadow-sheet)]"
            : "shadow-lg"
          : cool
            ? "shadow-[var(--shadow-float)]"
            : "shadow-sm",
        className,
      )}
      aria-label={`${title} breakdown`}
    >
      <header className={cn("flex items-baseline justify-between gap-3 border-b px-4 py-2.5", t.header)}>
        <Heading
          className={cn("font-mono text-2xs font-semibold tracking-[0.08em] uppercase", t.headerText)}
        >
          {title}
        </Heading>
        <div className="flex items-baseline gap-2.5">
          {reference && (
            <span className={cn("tabular font-mono text-2xs", t.reference)}>{reference}</span>
          )}
          <span className={cn("font-mono text-2xs tracking-wide uppercase", t.unit)}>GHS</span>
        </div>
      </header>

      <div className={cn("divide-y", t.divide)}>
        {lines.map((line, i) => (
          <Row key={i} label={line.kind} detail={line.description} amount={line.amount} t={t} />
        ))}
      </div>

      <div className={cn("border-t", t.rule)}>
        <Row
          label="Fee"
          detail={`ArtisanGH service fee, ${breakdown.commissionPct}%`}
          amount={breakdown.serviceFee}
          muted
          t={t}
        />
      </div>

      {/* The total. Heavier, a size step up, and on its own ground — the one
          thing on the docket the eye should land on first. */}
      <div className={cn("flex items-baseline gap-3 px-4 py-3.5", t.totalBand)}>
        <span
          className={cn("w-[4.75rem] shrink-0 font-mono text-2xs font-semibold tracking-wide uppercase", t.totalLabel)}
        >
          Total
        </span>
        <span className={cn("min-w-0 flex-1 text-note", t.totalDetail)}>
          Agreed before work starts
        </span>
        <span className={cn("tabular shrink-0 font-mono text-lede font-bold", t.totalAmount)}>
          {formatAmount(breakdown.grandTotal)}
        </span>
      </div>

      {showDeposit && (
        <div className={cn("divide-y border-t", t.divide, t.splitBand)}>
          <Row
            label="Deposit"
            detail="Held by ArtisanGH until sign-off"
            amount={breakdown.depositDue}
            muted
            t={t}
          />
          <Row
            label="Balance"
            detail="On completion, after you approve"
            amount={breakdown.balanceDue}
            muted
            t={t}
          />
        </div>
      )}
    </section>
  );
}
