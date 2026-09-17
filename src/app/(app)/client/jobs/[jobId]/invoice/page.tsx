import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { InvoiceDocument } from "@/components/jobs/invoice-document";
import { PrintButton } from "@/components/jobs/print-button";
import { getInvoice } from "@/lib/jobs/invoice";

export const metadata: Metadata = { title: "Invoice" };

/**
 * The invoice view (PLAN.md §11).
 *
 * Its own route rather than a panel on the job screen, because an invoice is a
 * thing you send someone. A URL can be reopened, forwarded and printed again;
 * a section of a dashboard cannot.
 *
 * `getInvoice` returns null for any job that has not been paid, so this 404s
 * rather than rendering an invoice for money that has not arrived. RLS is the
 * real boundary — the query runs through the anon client under the client's own
 * session, so another client's job is invisible here regardless of this check.
 */
export default async function InvoicePage({ params }: PageProps<"/client/jobs/[jobId]/invoice">) {
  const { jobId } = await params;

  const invoice = await getInvoice(jobId);
  if (!invoice) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/client/jobs/${jobId}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to job
        </Link>

        <PrintButton />
      </div>

      <InvoiceDocument invoice={invoice} />
    </div>
  );
}
