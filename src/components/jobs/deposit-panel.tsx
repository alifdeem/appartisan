"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { startDepositAction } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";
import { MOMO_NETWORK_LABELS } from "@/lib/phone";
import { formatCedis } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MomoNetwork } from "@/lib/supabase/types";

const NETWORKS: MomoNetwork[] = ["mtn", "telecel", "airteltigo"];

/**
 * Pay the deposit.
 *
 * The deposit is 50% of the marked-up total plus the whole transport fee — the
 * transport is charged upfront and in full so the artisan is never out of
 * pocket for travelling to a job that then falls through (PLAN.md §4).
 *
 * Three things this panel is careful about:
 *
 *  • **It states what the money buys and when it moves.** The platform holds
 *    the deposit until sign-off; the artisan is not paid on receipt. That is the
 *    product's actual promise and the reason a stranger is allowed into
 *    somebody's home, so it is said here rather than assumed.
 *
 *  • **A previous failure is shown, not swallowed.** A declined MoMo prompt is
 *    the most common real path, and "it didn't work, try again" with no reason
 *    is how somebody concludes the app is broken and phones support. The
 *    provider's own gateway response is surfaced verbatim.
 *
 *  • **It never claims anything is paid.** The button starts a charge and hands
 *    off to the prompt. Only the webhook may settle it.
 */
export function DepositPanel({
  jobId,
  amountDue,
  defaultNetwork,
  lastFailure,
}: {
  jobId: string;
  amountDue: number;
  /** Detected from the client's own number, so the common case is zero taps. */
  defaultNetwork: MomoNetwork | null;
  lastFailure: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [network, setNetwork] = React.useState<MomoNetwork>(defaultNetwork ?? "mtn");

  function pay() {
    if (pending) return;

    startTransition(async () => {
      const result = await startDepositAction(jobId, network);

      if (!result.ok || !result.authorizationUrl) {
        toast.error(result.error ?? "Could not start that payment.");
        return;
      }

      // The provider decides where payment happens — its hosted page live, our
      // simulated prompt in mock. Either way this screen does not handle money.
      router.push(result.authorizationUrl);
    });
  }

  return (
    <section className="overflow-hidden rounded-card border border-accent-300 bg-ink-0 shadow-sm">
      <div className="space-y-1 border-b border-accent-200 bg-accent-50 px-5 py-4">
        <p className="text-[0.6875rem] font-semibold tracking-wide text-accent-800 uppercase">
          Deposit due
        </p>
        <p className="tabular font-mono text-3xl leading-none font-semibold text-accent-900">
          {formatCedis(amountDue)}
        </p>
        <p className="pt-1 text-sm leading-relaxed text-accent-900/80">
          Covers half the work plus the full travel cost. Your artisan sets off once this clears.
        </p>
      </div>

      <div className="space-y-4 p-5">
        {lastFailure && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-card border border-danger-500/30 bg-danger-50 px-3.5 py-3"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger-600" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium text-danger-700">Last attempt didn&rsquo;t go through</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-700">{lastFailure}</p>
            </div>
          </div>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink-800">Pay with</legend>

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
                    "relative min-h-14 rounded-field border px-2 text-sm font-medium",
                    "transition-[border-color,background-color,color,transform] duration-[var(--duration-fast)] ease-out-strong",
                    "active:scale-[0.98]",
                    on
                      ? "border-brand-600 bg-brand-50 text-brand-900 ring-1 ring-brand-600"
                      : "border-ink-300 bg-ink-0 text-ink-700 hover:border-ink-400",
                  )}
                >
                  {on && (
                    <Check
                      className="absolute top-1.5 right-1.5 size-3.5 animate-fade-in text-brand-600"
                      strokeWidth={3}
                      aria-hidden
                    />
                  )}
                  {MOMO_NETWORK_LABELS[option]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Button type="button" variant="money" size="lg" block loading={pending} onClick={pay}>
          <Lock />
          Pay {formatCedis(amountDue)}
        </Button>

        {/* The promise, at the moment it matters. */}
        <div className="flex items-start gap-2.5 rounded-card bg-ink-50 px-3.5 py-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
          <p className="text-xs leading-relaxed text-ink-600">
            ArtisanGH holds this until you sign the work off — your artisan is not paid on
            arrival. Cancel before they set out and you get all of it back.
          </p>
        </div>
      </div>
    </section>
  );
}
