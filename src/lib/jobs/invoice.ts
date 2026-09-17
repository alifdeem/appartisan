import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getLatestQuote, type QuoteWithItems } from "@/lib/jobs/matching";
import { getClientJob, type JobWithCategory } from "@/lib/jobs/queries";
import { listJobPayments } from "@/lib/payments/queries";
import type { PaymentRow, PayoutRow, ProfileRow } from "@/lib/supabase/types";

/**
 * The invoice.
 *
 * PLAN.md §6 ends the lifecycle `PAID ──> invoice generated ──> payout queued`,
 * and §11 gives the client an "invoice view". This assembles it.
 *
 * Deliberately NOT a PDF library. The invoice is a route with a print
 * stylesheet, and the client saves it with their browser's own "Save as PDF".
 * Three reasons, in order of how much they matter here:
 *
 *   1. This is a Ghanaian mobile PWA on 3G. `@react-pdf/renderer` is ~500KB of
 *      JavaScript and Puppeteer means shipping Chromium; a print stylesheet is
 *      a few hundred bytes of CSS that never reaches the wire as JS at all.
 *   2. Every phone browser already does it — Share → Print → Save as PDF on
 *      iOS, the same through Chrome's print dialog on Android.
 *   3. It stays a real URL. A client can reopen it, send the link to whoever
 *      pays their bills, and print it again in a year. A generated blob is a
 *      file that exists once on one device.
 *
 * The trade is that we do not control the paper margins or the footer the
 * browser stamps on. For a receipt someone photographs and forwards on
 * WhatsApp, that is not the axis that matters.
 *
 * Every figure here is READ, never recomputed. `save_quote` did the arithmetic
 * in Postgres (migration 0011) and `settle_payment` recorded what actually
 * moved. An invoice that recalculates its own totals is an invoice that can
 * disagree with the money — see the header note in `money.ts`.
 */

export interface Invoice {
  job: JobWithCategory;
  quote: QuoteWithItems;
  client: Pick<ProfileRow, "full_name" | "phone">;
  provider: Pick<ProfileRow, "full_name" | "phone"> | null;
  payments: PaymentRow[];
  payout: PayoutRow | null;
  signedAt: string | null;
  clientNotes: string | null;
  /** Human invoice number, derived from the job reference so the two tie up. */
  number: string;
  /**
   * What the client owes in total.
   *
   * `quotes.total` is subtotal + service fee and **excludes transport** — the
   * transport fee is charged on top, in full, and passed to the artisan
   * (PLAN.md §4). `balance_due_for_job` in migration 0015 is the authority on
   * this and reads `(quote.total + quote.transport_fee) - banked`; this mirrors
   * that one expression and nothing else.
   *
   * Getting this wrong produces an invoice that lists a transport line and then
   * a total that does not include it, which is the sort of document a client
   * adds up by hand and then stops trusting.
   */
  grandTotal: number;
  /** Only the payments that actually cleared. */
  settled: PaymentRow[];
  totalPaid: number;
  isSimulated: boolean;
}

/**
 * An invoice exists once the money is in. Before that there is a quote, which
 * is a different document making a different claim — asking for money rather
 * than recording that it arrived.
 */
export const INVOICEABLE_STATUSES = ["paid", "closed"] as const;

export async function getInvoice(jobId: string): Promise<Invoice | null> {
  const job = await getClientJob(jobId);
  if (!job) return null;
  if (!INVOICEABLE_STATUSES.includes(job.status as (typeof INVOICEABLE_STATUSES)[number])) {
    return null;
  }

  const quote = await getLatestQuote(jobId);
  if (!quote) return null;

  const supabase = await createClient();

  // The counterparty policy in 0003 is what makes the artisan's name and number
  // readable here; both parties belong on an invoice.
  const [clientRow, providerRow, payments, payoutRow, signoffRow] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", job.client_id).maybeSingle(),
    job.provider_id
      ? supabase.from("profiles").select("full_name, phone").eq("id", job.provider_id).maybeSingle()
      : Promise.resolve({ data: null }),
    listJobPayments(jobId),
    supabase.from("payouts").select("*").eq("job_id", jobId).maybeSingle(),
    supabase.from("signoffs").select("signed_at, client_notes").eq("job_id", jobId).maybeSingle(),
  ]);

  if (!clientRow.data) return null;

  const settled = payments.filter((p) => p.status === "succeeded");

  return {
    job,
    quote,
    client: clientRow.data,
    provider: (providerRow.data as Pick<ProfileRow, "full_name" | "phone"> | null) ?? null,
    payments,
    payout: (payoutRow.data as PayoutRow | null) ?? null,
    signedAt: (signoffRow.data as { signed_at: string } | null)?.signed_at ?? null,
    clientNotes: (signoffRow.data as { client_notes: string | null } | null)?.client_notes ?? null,
    number: invoiceNumber(job.reference),
    grandTotal: Number(quote.total) + Number(quote.transport_fee),
    settled,
    totalPaid: settled.reduce((sum, p) => sum + Number(p.amount), 0),
    // Carried through rather than hidden. Once the platform is live we must be
    // able to tell a real invoice from a demo one forever (PLAN.md §10).
    isSimulated: settled.some((p) => p.is_simulated),
  };
}

/**
 * `AGH-260917-EA9F7` → `INV-260917-EA9F7`. Derived rather than sequential on
 * purpose: a counter needs a source of truth and a gap-free guarantee, and the
 * job reference already carries the date and is already unique.
 */
export function invoiceNumber(jobReference: string): string {
  return jobReference.replace(/^AGH-/, "INV-");
}
