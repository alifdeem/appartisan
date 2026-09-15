/**
 * Money.
 *
 * Mirrors `compute_quote_totals` in supabase/migrations/0002_functions.sql. The
 * arithmetic lives in both places on purpose so the two can be checked against
 * each other — a quote the UI renders and a quote the database stores must
 * never disagree by a pesewa.
 *
 * All amounts are cedis as numbers rounded to 2dp. Conversion to pesewas
 * happens only at the payment provider boundary.
 */

export const DEFAULT_COMMISSION_PCT = 12;
export const DEFAULT_DEPOSIT_PCT = 50;

/** Round half-up to pesewas. JS `toFixed` rounds half-to-even in some engines. */
export function toPesewaPrecision(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface QuoteBreakdown {
  /** What the artisan asked for. */
  subtotal: number;
  commissionPct: number;
  /** The platform's markup. Its only revenue line. */
  serviceFee: number;
  /** Passed to the artisan in full — a cost reimbursement, not revenue. */
  transportFee: number;
  /** What the client sees for the work itself (subtotal + serviceFee). */
  jobTotal: number;
  /** Collected before the artisan travels: 50% of jobTotal + all transport. */
  depositDue: number;
  /** Collected on site, before the artisan leaves. */
  balanceDue: number;
  /** Everything the client pays across both legs. */
  grandTotal: number;
  /** What the artisan receives after sign-off. */
  providerPayout: number;
}

export function computeQuote({
  subtotal,
  transportFee = 0,
  commissionPct = DEFAULT_COMMISSION_PCT,
  depositPct = DEFAULT_DEPOSIT_PCT,
  transportProviderSharePct = 100,
}: {
  subtotal: number;
  transportFee?: number;
  commissionPct?: number;
  depositPct?: number;
  transportProviderSharePct?: number;
}): QuoteBreakdown {
  const serviceFee = toPesewaPrecision((subtotal * commissionPct) / 100);
  const jobTotal = toPesewaPrecision(subtotal + serviceFee);

  // Transport is charged upfront and in full so the artisan is never out of
  // pocket for travel, then the deposit covers half the work.
  const depositDue = toPesewaPrecision((jobTotal * depositPct) / 100 + transportFee);
  const balanceDue = toPesewaPrecision(jobTotal - toPesewaPrecision((jobTotal * depositPct) / 100));
  const grandTotal = toPesewaPrecision(jobTotal + transportFee);

  const providerPayout = toPesewaPrecision(
    subtotal + toPesewaPrecision((transportFee * transportProviderSharePct) / 100),
  );

  return {
    subtotal: toPesewaPrecision(subtotal),
    commissionPct,
    serviceFee,
    transportFee: toPesewaPrecision(transportFee),
    jobTotal,
    depositDue,
    balanceDue,
    grandTotal,
    providerPayout,
  };
}

/**
 * What the platform actually keeps, after the payment gateway takes its cut.
 *
 * Worth surfacing in the admin dashboard rather than hiding: on a GHS 400 job
 * the platform nets around GHS 38, and on a GHS 100 job around GHS 10 before
 * payout transfer fees. That is why PLAN.md §16 raises a minimum job value.
 */
export const PAYSTACK_FEE_PCT = 1.95;

export function computePlatformNet(
  breakdown: QuoteBreakdown,
  gatewayFeePct = PAYSTACK_FEE_PCT,
): { gatewayFee: number; net: number } {
  const gatewayFee = toPesewaPrecision((breakdown.grandTotal * gatewayFeePct) / 100);
  const net = toPesewaPrecision(breakdown.grandTotal - gatewayFee - breakdown.providerPayout);
  return { gatewayFee, net };
}

const formatter = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  minimumFractionDigits: 2,
});

/** "GHS 448.00" */
export function formatCedis(amount: number): string {
  return formatter.format(amount).replace("GH₵", "GHS ");
}

/** "448.00" — for use next to an explicit GHS label. */
export function formatAmount(amount: number): string {
  return toPesewaPrecision(amount).toFixed(2);
}
