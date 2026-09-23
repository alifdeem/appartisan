import { Check, RotateCcw } from "lucide-react";

import { formatAmount } from "@/lib/money";
import { MOMO_NETWORK_LABELS } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { PaymentRow } from "@/lib/supabase/types";

/**
 * What was actually paid.
 *
 * Set as a document rather than a status list, for the same reason the quote
 * docket is: mono with tabular figures and a real provider reference reads as
 * something that happened, which is what somebody wants when they are checking
 * whether their money arrived.
 *
 * **Failed attempts are listed too.** The instinct is to show only the success
 * and keep the screen tidy, and it is wrong — a client who was declined twice
 * before a payment went through will be looking for exactly those two rows when
 * three debits appear on their statement. The partial unique index in migration
 * 0012 keeps the attempts precisely so this can show them.
 *
 * `is_simulated` is carried through rather than hidden. Once the platform goes
 * live we have to be able to tell a real transaction from a demo one forever
 * (PLAN.md §10), and a receipt that does not say which it is undermines that.
 */
export function PaymentReceipt({
  payments,
  headingLevel = 2,
}: {
  payments: PaymentRow[];
  headingLevel?: 2 | 3;
}) {
  if (payments.length === 0) return null;

  const Heading = `h${headingLevel}` as const;

  return (
    <section
      className="overflow-hidden rounded-[1.25rem] border border-hairline bg-white"
      aria-label="Payments"
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-hairline bg-canvas px-4 py-2.5">
        <Heading className="font-mono text-2xs font-semibold tracking-[0.08em] text-navy-900 uppercase">
          Payments
        </Heading>
        <span className="font-mono text-2xs tracking-wide text-copy-muted uppercase">GHS</span>
      </header>

      <ul className="divide-y divide-hairline">
        {payments.map((payment) => {
          const succeeded = payment.status === "succeeded";
          const refunded = payment.status === "refunded";

          return (
            <li key={payment.id} className="flex items-start gap-3 px-4 py-3">
              <span
                className={cn(
                  "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                  succeeded && "bg-success-50 text-success-700",
                  refunded && "bg-azure-50 text-azure-700",
                  !succeeded && !refunded && "bg-canvas text-copy-muted",
                )}
              >
                {succeeded ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                ) : refunded ? (
                  <RotateCcw className="size-3.5" aria-hidden />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" aria-hidden />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-note">
                  <span className="font-semibold text-navy-900 capitalize">{payment.leg}</span>
                  <span
                    className={cn(
                      "text-2xs",
                      succeeded
                        ? "text-success-700"
                        : refunded
                          ? "text-azure-700"
                          : "text-copy-muted",
                    )}
                  >
                    {refunded ? "refunded" : payment.status}
                  </span>
                  {payment.is_simulated && (
                    <span className="text-2xs text-warning-700">simulated</span>
                  )}
                </p>

                <p className="tabular mt-0.5 truncate font-mono text-2xs text-copy-muted">
                  {payment.provider_reference}
                  {payment.momo_network && ` · ${MOMO_NETWORK_LABELS[payment.momo_network]}`}
                </p>

                {payment.failure_reason && !refunded && (
                  <p className="mt-1 text-2xs leading-snug text-danger-600">
                    {payment.failure_reason}
                  </p>
                )}
              </div>

              <span
                className={cn(
                  "tabular shrink-0 font-mono text-note",
                  succeeded
                    ? "font-bold text-navy-900"
                    : "text-copy-muted line-through decoration-copy-muted/50",
                )}
              >
                {formatAmount(Number(payment.amount))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
