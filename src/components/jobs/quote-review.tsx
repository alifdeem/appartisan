"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Info, X } from "lucide-react";
import { toast } from "sonner";

import { respondToQuoteAction } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";
import { QuoteDocket, type QuoteLine } from "@/components/marketplace/quote-docket";
import { Textarea } from "@/components/ui/input";
import { computeQuote, formatCedis } from "@/lib/money";
import type { QuoteItemRow, QuoteRow } from "@/lib/supabase/types";

/**
 * The price, and the client's answer.
 *
 * This is the screen the whole product argues towards — DESIGN.md §2 makes the
 * docket one of two signature objects precisely because agreeing the number
 * before anyone picks up a tool is the thing no competitor does.
 *
 * **Declining is a real, equal option, not a hidden one.** With no price
 * guidance in v1 artisans price freely and clients decline, and PLAN.md §6 asks
 * that the path read as "we'll find you another artisan" rather than as an
 * error. So the decline button is a peer of the accept button rather than a
 * grey link underneath it, and the copy says what actually happens next: the
 * job goes back out, nothing is charged, nobody has been let down.
 *
 * **Declining asks for a reason and does not require one.** Forcing a
 * justification would depress the decline rate rather than improve the data —
 * and a job bounced back with no explanation still tells us the number was
 * wrong.
 *
 * **Accepting is the one place a confirmation step earns its keep.** It is the
 * moment the client takes on a payment obligation, so the button says the
 * amount rather than "Accept".
 */
export function QuoteReview({
  quote,
  items,
  /** How many declines are left before a job stops rematching (PLAN.md §16 q5). */
  rejectionsLeft,
  reference,
}: {
  quote: QuoteRow;
  items: QuoteItemRow[];
  rejectionsLeft: number;
  reference: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [decliningOpen, setDecliningOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [choice, setChoice] = React.useState<"accept" | "decline" | null>(null);

  const breakdown = computeQuote({
    subtotal: Number(quote.subtotal),
    transportFee: Number(quote.transport_fee),
    commissionPct: Number(quote.service_fee_pct),
  });

  const lines: QuoteLine[] = items.map((item) => ({
    kind: item.kind === "labour" ? "Labour" : "Materials",
    description:
      Number(item.quantity) === 1
        ? item.description
        : `${item.description} × ${Number(item.quantity)}`,
    amount: Number(item.amount),
  }));

  if (Number(quote.transport_fee) > 0) {
    lines.push({
      kind: "Transport",
      description: "Travel to your address",
      amount: Number(quote.transport_fee),
    });
  }

  function respond(accept: boolean) {
    if (pending) return;
    setChoice(accept ? "accept" : "decline");

    startTransition(async () => {
      const result = await respondToQuoteAction(quote.id, accept, accept ? undefined : reason);

      if (!result.ok) {
        setChoice(null);
        toast.error(result.error ?? "Could not send your answer.");
        return;
      }

      toast.success(
        accept
          ? "Price agreed. Next step is the deposit."
          : "No problem — we're finding you another artisan.",
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <QuoteDocket
        lines={lines}
        breakdown={breakdown}
        reference={reference}
        title="Your quote"
        elevated
      />

      {quote.notes && (
        <div className="flex items-start gap-2.5 rounded-card border border-ink-200 bg-ink-0 px-4 py-3 shadow-xs">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-500">From your artisan</p>
            <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-ink-800">
              {quote.notes}
            </p>
          </div>
        </div>
      )}

      {decliningOpen ? (
        <div className="animate-fade-up space-y-3 rounded-card border border-ink-200 bg-ink-0 p-4 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-ink-900">
              We&rsquo;ll find you another artisan
            </h3>
            <p className="text-sm leading-relaxed text-ink-600">
              Nothing is charged and your job stays exactly as you described it. This artisan
              won&rsquo;t be offered it again.
              {rejectionsLeft <= 1 && (
                <>
                  {" "}
                  This is your last automatic rematch — after it, our team calls you instead.
                </>
              )}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="declineReason" className="block text-sm font-medium text-ink-800">
              Anything you want to tell us?
              <span className="ml-1.5 text-xs font-normal text-ink-400">optional</span>
            </label>
            <Textarea
              id="declineReason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Too expensive for what I need, or I wanted it sooner."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              loading={pending && choice === "decline"}
              disabled={pending}
              onClick={() => respond(false)}
            >
              <X />
              Decline and rematch
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setDecliningOpen(false)}
            >
              Keep looking at it
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* The amount is on the button. "Accept" on its own is a word; the
              number is the thing being agreed to. */}
          <Button
            type="button"
            variant="money"
            size="lg"
            block
            loading={pending && choice === "accept"}
            disabled={pending}
            onClick={() => respond(true)}
          >
            <Check />
            Accept {formatCedis(breakdown.grandTotal)}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            block
            disabled={pending}
            onClick={() => setDecliningOpen(true)}
          >
            This isn&rsquo;t right for me
          </Button>

          <p className="text-center text-xs leading-relaxed text-ink-500">
            You pay {formatCedis(breakdown.depositDue)} now and{" "}
            {formatCedis(breakdown.balanceDue)} when the work is signed off. Nothing is charged
            until you accept.
          </p>
        </div>
      )}
    </div>
  );
}
