"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { callAction } from "@/lib/action-call";

import { startBalanceAction, startDepositAction } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/mobile/field-label";
import { MOMO_NETWORK_LABELS } from "@/lib/phone";
import { formatCedis } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MomoNetwork } from "@/lib/supabase/types";

const NETWORKS: MomoNetwork[] = ["mtn", "telecel", "airteltigo"];

/**
 * Paying by Mobile Money — the deposit or the balance.
 *
 * **One component where there were two.** `DepositPanel` and `BalancePanel`
 * were a hundred and forty lines each and differed in four strings and which
 * action they called. They had already drifted once. The leg is now a prop and
 * the copy is a lookup, so the two moments of this product where money actually
 * moves cannot look like two different products.
 *
 * The legs are genuinely different, and the copy says so rather than
 * generalising:
 *
 *  • **Deposit** is 50% of the marked-up total *plus the whole transport fee*.
 *    Transport is charged upfront and in full so the artisan is never out of
 *    pocket for travelling to a job that then falls through (PLAN.md §4).
 *  • **Balance** has to be collected while the artisan is still standing there.
 *    PLAN.md §4 again: mobile money in Ghana has no tokenisation and no
 *    recurring billing, so every charge needs the customer to approve a fresh
 *    USSD prompt on their own phone. There is no way to take it afterwards.
 *    Design it any other way and you get unpaid balances and angry artisans.
 *
 * Three things this panel is careful about, unchanged from the pair it replaces:
 *
 *  • **It states what the money buys and when it moves.** The platform holds
 *    the deposit until sign-off; the artisan is not paid on receipt. That is
 *    the product's actual promise and the reason a stranger is allowed into
 *    somebody's home, so it is said here rather than assumed.
 *  • **A previous failure is shown, not swallowed.** A declined MoMo prompt is
 *    the most common real path, and "it didn't work, try again" with no reason
 *    is how somebody concludes the app is broken and phones support. The
 *    provider's own gateway response is surfaced verbatim.
 *  • **It never claims anything is paid.** The button starts a charge and hands
 *    off to the prompt. Only the webhook may settle it.
 */

const COPY = {
  deposit: {
    label: "Deposit due",
    explain: "Covers half the work plus the full travel cost. Your artisan sets off once this clears.",
    promise:
      "ArtisanGH holds this until you sign the work off — your artisan is not paid on arrival. Cancel before they set out and you get all of it back.",
  },
  balance: {
    label: "Balance due",
    explain: "The rest of the agreed price. Pay it now, while your artisan is still with you.",
    promise:
      "This releases the whole payment to your artisan. If something is wrong, report it before you pay and we will hold their payout.",
  },
} as const;

export function MomoPayPanel({
  jobId,
  leg,
  amountDue,
  defaultNetwork,
  lastFailure,
}: {
  jobId: string;
  leg: "deposit" | "balance";
  amountDue: number;
  /** Detected from the client's own number, so the common case is zero taps. */
  defaultNetwork: MomoNetwork | null;
  lastFailure: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [network, setNetwork] = React.useState<MomoNetwork>(defaultNetwork ?? "mtn");
  const copy = COPY[leg];

  function pay() {
    if (pending) return;

    startTransition(async () => {
      const result = await callAction(() =>
        leg === "deposit"
          ? startDepositAction(jobId, network)
          : startBalanceAction(jobId, network),
      );

      if (!result.ok || !("authorizationUrl" in result) || !result.authorizationUrl) {
        toast.error(result.error ?? "Could not start that payment.");
        return;
      }

      // The provider decides where payment happens — its hosted page live, our
      // simulated prompt in mock. Either way this screen does not handle money.
      router.push(result.authorizationUrl);
    });
  }

  return (
    <section className="animate-fade-up overflow-hidden rounded-[1.5rem] shadow-[var(--shadow-sheet)]">
      {/* The figure gets the navy. Money on this screen is the one thing the
          client has to act on, and the same surface that carries an artisan's
          earnings carries what a client owes — one language for one subject. */}
      <div
        className={cn(
          "relative isolate overflow-hidden p-5",
          "bg-linear-to-br from-navy-700 via-navy-800 to-navy-900",
        )}
      >
        <span
          aria-hidden
          className="absolute -top-20 -right-10 -z-10 size-52 rounded-full bg-azure-400/30 blur-3xl"
        />

        <FieldLabel className="text-white/60">{copy.label}</FieldLabel>
        <p className="tabular mt-1.5 font-mono text-title-lg leading-none font-bold text-white">
          {formatCedis(amountDue)}
        </p>
        <p className="mt-3 max-w-[20rem] text-note leading-relaxed text-white/75">
          {copy.explain}
        </p>
      </div>

      <div className="space-y-4 border-x border-b border-hairline bg-white p-5">
        {lastFailure && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[1rem] border border-danger-500/30 bg-danger-50 px-3.5 py-3"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger-600" aria-hidden />
            <div className="min-w-0">
              <p className="text-note font-semibold text-danger-700">
                Last attempt didn&rsquo;t go through
              </p>
              <p className="mt-0.5 text-note leading-relaxed text-navy-900/80">{lastFailure}</p>
            </div>
          </div>
        )}

        <fieldset className="space-y-2.5">
          <FieldLabel as="legend">Pay with</FieldLabel>

          <div className="grid grid-cols-3 gap-2">
            {NETWORKS.map((option) => {
              const on = network === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setNetwork(option)}
                  aria-pressed={on}
                  className={cn(
                    "min-h-14 rounded-[1rem] border px-1 text-note font-semibold",
                    "transition-[border-color,background-color,color,box-shadow,transform] duration-[var(--duration-fast)] ease-out-strong",
                    "active:scale-[0.97]",
                    on
                      ? "border-azure-500 bg-azure-50 text-navy-900 ring-1 ring-azure-500"
                      : "border-hairline bg-white text-copy-muted hover:border-azure-300 hover:text-navy-900",
                  )}
                >
                  {MOMO_NETWORK_LABELS[option]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Button
          type="button"
          variant="navy"
          size="lg"
          shape="pill"
          block
          loading={pending}
          onClick={pay}
        >
          <Lock />
          Pay {formatCedis(amountDue)}
        </Button>

        {/* The promise, at the moment it matters. */}
        <div className="flex items-start gap-2.5 rounded-[1rem] bg-azure-50 px-3.5 py-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-navy-800" aria-hidden />
          <p className="text-2xs leading-relaxed text-navy-900/75">{copy.promise}</p>
        </div>
      </div>
    </section>
  );
}
