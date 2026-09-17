import { Check } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { formatAmount } from "@/lib/money";
import { MOMO_NETWORK_LABELS, formatPhoneForDisplay } from "@/lib/phone";
import type { Invoice } from "@/lib/jobs/invoice";
import { cn } from "@/lib/utils";

/**
 * The invoice document.
 *
 * Set as a document, not a dashboard panel — the same reasoning as the quote
 * docket, carried to its conclusion. Mono, tabular figures, ruled rows, and a
 * width that holds on A4 as well as it does on a phone.
 *
 * **No amber anywhere.** DESIGN.md reserves the accent ramp for money that is
 * *owed or held* — a quote total, a deposit due. An invoice records money that
 * has already moved, so it is not owed, and painting it amber would quietly
 * drain the meaning out of every screen that legitimately uses it. The settled
 * total sets in ink instead, with the paid mark carrying the colour.
 *
 * Everything is read from the database. `save_quote` computed the quote in
 * Postgres and `settle_payment` recorded what cleared; nothing here does
 * arithmetic beyond summing rows that already exist.
 */

function Row({
  kind,
  description,
  detail,
  amount,
  muted = false,
  strong = false,
}: {
  kind?: string;
  description: string;
  detail?: string;
  amount: number | string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-2.5 print:px-0">
      {kind !== undefined && (
        <span className="w-[4.75rem] shrink-0 font-mono text-[0.6875rem] tracking-wide text-ink-500 uppercase">
          {kind}
        </span>
      )}
      <span
        className={cn(
          "min-w-0 flex-1 text-[0.8125rem]",
          muted ? "text-ink-500" : "text-ink-800",
          strong && "font-medium text-ink-900",
        )}
      >
        {description}
        {detail && <span className="ml-1.5 text-ink-400">{detail}</span>}
      </span>
      <span
        className={cn(
          "shrink-0 font-mono text-[0.8125rem] tabular",
          muted ? "text-ink-500" : "text-ink-800",
          strong && "text-base font-semibold text-ink-900",
        )}
      >
        {typeof amount === "number" ? formatAmount(amount) : amount}
      </span>
    </div>
  );
}

function Party({
  label,
  name,
  phone,
}: {
  label: string;
  name: string;
  phone: string | null;
}) {
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-500 uppercase">
        {label}
      </p>
      <p className="text-[0.9375rem] font-medium text-ink-900">{name}</p>
      {phone && <p className="tabular font-mono text-[0.8125rem] text-ink-600">{formatPhoneForDisplay(phone)}</p>}
    </div>
  );
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });
const DATETIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const { job, quote, client, provider, settled, payout, signedAt, clientNotes, number } = invoice;

  const labour = quote.items.filter((i) => i.kind === "labour");
  const materials = quote.items.filter((i) => i.kind === "material");
  const paidOn = settled.reduce<string | null>(
    (latest, p) => (p.paid_at && (!latest || p.paid_at > latest) ? p.paid_at : latest),
    null,
  );

  return (
    <article className="mx-auto max-w-[46rem] overflow-hidden rounded-card border border-ink-200 bg-ink-0 shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      {/* Masthead ------------------------------------------------------- */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-200 px-6 py-5 print:px-0">
        <div className="space-y-2">
          <Logo className="h-7" />
          <p className="max-w-[18rem] text-[0.75rem] leading-snug text-ink-500">
            Verified home services across Accra and Tema.
          </p>
        </div>

        <div className="space-y-1 text-right">
          <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-500 uppercase">
            Invoice
          </p>
          <p className="tabular font-mono text-[0.9375rem] font-semibold text-ink-900">{number}</p>
          {paidOn && <p className="text-[0.75rem] text-ink-500">{DATE.format(new Date(paidOn))}</p>}
          <p
            className="inline-flex items-center gap-1 rounded-field bg-brand-50 px-2 py-0.5 font-mono text-[0.6875rem] font-semibold tracking-wide text-brand-700 uppercase"
            aria-label="This invoice is paid in full"
          >
            <Check className="size-3" aria-hidden />
            Paid in full
          </p>
        </div>
      </header>

      {/* Simulation notice ---------------------------------------------- */}
      {invoice.isSimulated && (
        <p className="border-b border-dashed border-accent-300 bg-accent-50 px-6 py-2 text-center font-mono text-[0.6875rem] tracking-wide text-accent-900 uppercase print:px-0">
          Simulated — no money moved
        </p>
      )}

      {/* Parties --------------------------------------------------------- */}
      <div className="grid gap-5 border-b border-ink-200 px-6 py-5 sm:grid-cols-3 print:px-0">
        <Party label="Billed to" name={client.full_name} phone={client.phone} />
        {provider && <Party label="Work by" name={provider.full_name} phone={provider.phone} />}
        <div className="space-y-0.5">
          <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-500 uppercase">
            Job
          </p>
          <p className="text-[0.9375rem] font-medium text-ink-900">{job.category?.name ?? "Service"}</p>
          <p className="tabular font-mono text-[0.8125rem] text-ink-600">{job.reference}</p>
        </div>
      </div>

      {/* Where ----------------------------------------------------------- */}
      {(job.address_text || job.landmark) && (
        <div className="border-b border-ink-200 px-6 py-3 print:px-0">
          <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-500 uppercase">
            Address
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-700">
            {[job.address_text, job.landmark, job.ghanapost_code].filter(Boolean).join(" · ")}
          </p>
        </div>
      )}

      {/* Lines ----------------------------------------------------------- */}
      <div className="border-b border-ink-200">
        <div className="flex items-baseline justify-between gap-3 bg-ink-25 px-6 py-2 print:px-0">
          <h2 className="font-mono text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-700 uppercase">
            Work carried out
          </h2>
          <span className="font-mono text-[0.6875rem] tracking-wide text-ink-500 uppercase">GHS</span>
        </div>

        <div className="divide-y divide-ink-100 px-2 print:px-0">
          {labour.map((item) => (
            <Row
              key={item.id}
              kind="Labour"
              description={item.description}
              detail={item.quantity > 1 ? `× ${item.quantity}` : undefined}
              amount={Number(item.amount)}
            />
          ))}
          {materials.map((item) => (
            <Row
              key={item.id}
              kind="Materials"
              description={item.description}
              detail={item.quantity > 1 ? `× ${item.quantity}` : undefined}
              amount={Number(item.amount)}
            />
          ))}
        </div>
      </div>

      {/* Totals ---------------------------------------------------------- */}
      <div className="divide-y divide-ink-100 border-b border-ink-200 px-2 print:px-0">
        <Row kind="" description="Subtotal" amount={Number(quote.subtotal)} muted />
        <Row
          kind=""
          description="Service fee"
          detail={`${Number(quote.service_fee_pct)}%`}
          amount={Number(quote.service_fee_amount)}
          muted
        />
        {Number(quote.transport_fee) > 0 && (
          <Row
            kind=""
            description="Transport"
            detail="paid to the artisan in full"
            amount={Number(quote.transport_fee)}
            muted
          />
        )}
      </div>

      <div className="flex items-baseline gap-3 border-b-2 border-ink-900 bg-ink-25 px-6 py-3 print:px-0">
        <span className="font-mono text-[0.6875rem] font-semibold tracking-wide text-ink-700 uppercase">
          Total
        </span>
        <span className="flex-1" />
        <span className="tabular font-mono text-lg font-semibold text-ink-900">
          {formatAmount(invoice.grandTotal)}
        </span>
      </div>

      {/* Payments -------------------------------------------------------- */}
      <div className="border-b border-ink-200">
        <div className="bg-ink-25 px-6 py-2 print:px-0">
          <h2 className="font-mono text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-700 uppercase">
            Payments received
          </h2>
        </div>
        <div className="divide-y divide-ink-100 px-2 print:px-0">
          {settled.map((p) => (
            <Row
              key={p.id}
              kind={p.leg}
              description={
                p.momo_network ? MOMO_NETWORK_LABELS[p.momo_network] : (p.channel ?? "Mobile money")
              }
              detail={p.paid_at ? DATETIME.format(new Date(p.paid_at)) : undefined}
              amount={Number(p.amount)}
            />
          ))}
          <Row description="Total paid" amount={invoice.totalPaid} strong />
        </div>
      </div>

      {/* Sign-off -------------------------------------------------------- */}
      {signedAt && (
        <div className="border-b border-ink-200 px-6 py-4 print:px-0">
          <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-500 uppercase">
            Signed off
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-700">
            Accepted as complete by {client.full_name} on {DATETIME.format(new Date(signedAt))}.
          </p>
          {clientNotes && <p className="mt-1 text-[0.8125rem] text-ink-600 italic">“{clientNotes}”</p>}
        </div>
      )}

      {/* Footer ---------------------------------------------------------- */}
      <footer className="space-y-1 px-6 py-4 text-[0.6875rem] leading-relaxed text-ink-500 print:px-0">
        {/* The agency wording is not decorative. PLAN.md §4 puts the platform in
            PSP Standard rather than E-Money Issuer, and that position depends on
            collecting as the artisan's agent rather than holding value. */}
        <p>
          ArtisanGH collects payment as agent of the artisan named above. The contract for the work
          is between the client and the artisan.
        </p>
        {payout && (
          <p className="tabular font-mono">
            Artisan payout {formatAmount(Number(payout.amount))} · {payout.status}
            {payout.transfer_reference ? ` · ${payout.transfer_reference}` : ""}
          </p>
        )}
      </footer>
    </article>
  );
}
