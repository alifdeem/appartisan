"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Delete, Loader2, Smartphone } from "lucide-react";

import {
  pollPaymentStatusAction,
  settleSimulatedChargeAction,
} from "@/app/pay/simulate/[reference]/actions";
import { Button } from "@/components/ui/button";
import { MOMO_NETWORK_LABELS, formatPhoneForDisplay } from "@/lib/phone";
import { formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { SimulatedOutcome } from "@/lib/integrations/payments/types";
import type { MomoNetwork } from "@/lib/supabase/types";

/**
 * The simulated USSD prompt.
 *
 * PLAN.md §4 Finding 2: mobile money cannot be charged silently. Every charge
 * needs the customer present, approving a fresh prompt with their PIN. That
 * single fact dictates the shape of the end of a job, so this screen is built
 * to teach it rather than to be convenient.
 *
 * Which means the deliberately awkward parts are the point:
 *
 *  • **A PIN pad, not a "Pay now" button.** Any four digits are accepted —
 *    nothing is checked, and the screen says so. What matters is that everyone
 *    who demos this internalises that a charge needs a human with a handset,
 *    because the balance leg in Phase 5 depends on it being collected while the
 *    artisan is still standing there.
 *
 *  • **The page waits for the webhook rather than believing the button.**
 *    Approving fires a signed payload at `/api/webhooks/payments` over real
 *    HTTP; this screen then polls the database until the row actually says
 *    `succeeded`. A payment screen that congratulates you on the strength of
 *    your own tap is the exact lie this simulation exists to avoid.
 *
 *  • **Amber, and only here.** DESIGN.md §3 reserves it for money. This is the
 *    most literal money screen in the product, so the amount carries it.
 */

type Phase = "prompt" | "sending" | "waiting" | "success" | "failed";

const PIN_LENGTH = 4;

/** What each forced outcome is called on screen, for the dev panel. */
const FORCED: { outcome: SimulatedOutcome; label: string }[] = [
  { outcome: "failed", label: "Declined" },
  { outcome: "insufficient_funds", label: "No funds" },
  { outcome: "timeout", label: "Timed out" },
];

export function MomoPrompt({
  reference,
  amount,
  network,
  phone,
  jobId,
  jobReference,
  status,
  failureReason,
  showDevControls,
}: {
  reference: string;
  amount: number;
  network: MomoNetwork | null;
  phone: string;
  jobId: string;
  jobReference: string;
  status: string;
  failureReason: string | null;
  showDevControls: boolean;
}) {
  const router = useRouter();

  const [phase, setPhase] = React.useState<Phase>(status === "failed" ? "failed" : "prompt");
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState<string | null>(
    status === "failed" ? failureReason : null,
  );

  const networkLabel = network ? MOMO_NETWORK_LABELS[network] : "Mobile money";

  /**
   * Approve, then watch the database rather than the button.
   *
   * The delay before polling starts is not theatre — the webhook is a real HTTP
   * round trip and answering "did it work?" a millisecond after firing it would
   * always read `pending` and always look like a failure.
   */
  async function approve(outcome: SimulatedOutcome) {
    setError(null);
    setPhase("sending");

    const settled = await settleSimulatedChargeAction(reference, outcome);

    if (!settled.ok) {
      setPhase("failed");
      setError(settled.error ?? "That did not go through.");
      return;
    }

    setPhase("waiting");

    // Up to ~8 seconds. A provider that has not answered by then has not
    // answered, and the honest thing is to say so and let them check the job.
    for (let attempt = 0; attempt < 16; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await pollPaymentStatusAction(reference);

      if (result.status === "succeeded") {
        setPhase("success");
        // Let the tick land before navigating. This is the one moment in the
        // app where a beat of delight is earned — it is rare, and it is the
        // moment somebody's money moved.
        setTimeout(() => router.push(`/client/jobs/${jobId}?paid=1`), 900);
        return;
      }

      if (result.status === "failed") {
        setPhase("failed");
        setError(result.failureReason ?? "The payment was not approved.");
        return;
      }
    }

    setPhase("failed");
    setError("We did not hear back in time. Check the job before trying again.");
  }

  function press(digit: string) {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      // A real prompt submits on the last digit. So does this.
      setTimeout(() => void approve("success"), 180);
    }
  }

  const busy = phase === "sending" || phase === "waiting";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-8">
      {/* The handset. Warm charcoal rather than black — DESIGN.md §3 keeps the
          one dark surface in the system warm so it sits with the paper. */}
      <div className="overflow-hidden rounded-[1.5rem] border border-navy-950/20 bg-navy-950 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <span className="flex items-center gap-2 text-[0.6875rem] font-medium tracking-wide text-white/60 uppercase">
            <Smartphone className="size-3.5" aria-hidden />
            {networkLabel}
          </span>
          <span className="tabular font-mono text-[0.6875rem] text-white/40">
            {formatPhoneForDisplay(phone)}
          </span>
        </div>

        <div className="space-y-4 px-5 py-6">
          {phase === "success" ? (
            <Settled
              tone="success"
              title="Payment approved"
              body={`${formatAmount(amount)} sent to ArtisanGH.`}
            />
          ) : phase === "failed" ? (
            <Settled
              tone="danger"
              title="Not approved"
              body={error ?? "The payment did not go through. Nothing was taken."}
            />
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-[0.6875rem] font-medium tracking-wide text-white/50 uppercase">
                  Payment request
                </p>
                <p className="text-sm leading-relaxed text-white/80">
                  <span className="font-semibold text-white">ARTISANGH</span> is requesting a
                  payment from your {networkLabel} wallet.
                </p>
              </div>

              <dl className="space-y-1.5 rounded-card bg-white/5 px-4 py-3 font-mono text-[0.8125rem]">
                <Row label="Amount">
                  <span className="tabular text-base font-semibold text-warning-500">
                    GHS {formatAmount(amount)}
                  </span>
                </Row>
                <Row label="Reference">
                  <span className="tabular text-white/70">{jobReference}</span>
                </Row>
                <Row label="For">
                  <span className="text-white/70">Job deposit</span>
                </Row>
              </dl>

              {busy ? (
                <div className="flex items-center gap-3 rounded-card bg-white/5 px-4 py-4">
                  <Loader2 className="size-5 shrink-0 animate-spin text-white/70" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      {phase === "sending" ? "Sending to your network…" : "Waiting for confirmation…"}
                    </p>
                    <p className="text-xs leading-snug text-white/50">
                      Your network is confirming with ArtisanGH. Don&rsquo;t close this.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    <p className="text-center text-[0.8125rem] text-white/70">
                      Enter your MoMo PIN to approve
                    </p>

                    <div className="flex justify-center gap-3" aria-hidden>
                      {Array.from({ length: PIN_LENGTH }, (_, index) => (
                        <span
                          key={index}
                          className={cn(
                            "size-3 rounded-full transition-[background-color,transform]",
                            "duration-[var(--duration-instant)] ease-out-strong",
                            index < pin.length
                              ? "scale-110 bg-warning-500"
                              : "bg-white/20",
                          )}
                        />
                      ))}
                    </div>
                    <p className="sr-only" role="status">
                      {pin.length} of {PIN_LENGTH} digits entered
                    </p>
                  </div>

                  <Keypad onPress={press} onDelete={() => setPin((p) => p.slice(0, -1))} />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {phase === "prompt" && (
        <p className="text-center text-xs leading-relaxed text-copy-muted">
          This is a simulation — no money moves and any four digits are accepted. The real thing
          sends this prompt to your handset, which is why someone has to be present to pay.
        </p>
      )}

      {phase === "failed" && (
        <div className="space-y-2.5">
          <Button
            type="button"
            size="lg"
            block
            onClick={() => {
              setPin("");
              setError(null);
              setPhase("prompt");
            }}
          >
            Try again
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            block
            onClick={() => router.push(`/client/jobs/${jobId}`)}
          >
            <ArrowLeft />
            Back to the job
          </Button>
        </div>
      )}

      {/* The unhappy paths, forced. PLAN.md §3 asks for exactly this so failure,
          timeout and insufficient funds get built and tested now rather than
          discovered in production. Stripped from production builds. */}
      {showDevControls && phase === "prompt" && (
        <div className="space-y-2 rounded-card border border-dashed border-warning-500/40 bg-warning-50/60 p-3">
          <p className="text-[0.6875rem] font-semibold tracking-wide text-warning-700 uppercase">
            Force an outcome
          </p>
          <div className="grid grid-cols-3 gap-2">
            {FORCED.map((forced) => (
              <button
                key={forced.outcome}
                type="button"
                onClick={() => void approve(forced.outcome)}
                className={cn(
                  "min-h-9 rounded-field border border-hairline bg-white text-xs font-medium text-copy",
                  "transition-[background-color,transform] duration-[var(--duration-instant)] ease-out-strong",
                  "hover:bg-canvas active:scale-[0.97]",
                )}
              >
                {forced.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-white/40">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Settled({
  tone,
  title,
  body,
}: {
  tone: "success" | "danger";
  title: string;
  body: string;
}) {
  return (
    <div className="animate-fade-up space-y-3 py-4 text-center">
      <span
        className={cn(
          "mx-auto grid size-14 place-items-center rounded-full",
          tone === "success" ? "bg-success-500/15 text-success-500" : "bg-danger-500/15 text-danger-500",
        )}
      >
        {tone === "success" ? (
          <Check className="size-7" strokeWidth={2.5} aria-hidden />
        ) : (
          <AlertTriangle className="size-7" aria-hidden />
        )}
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-white">{title}</p>
        <p className="mx-auto max-w-[22rem] text-sm leading-relaxed text-white/60">{body}</p>
      </div>
    </div>
  );
}

function Keypad({
  onPress,
  onDelete,
}: {
  onPress: (digit: string) => void;
  onDelete: () => void;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key, index) => {
        if (key === "") return <span key={index} />;

        const isDelete = key === "del";

        return (
          <button
            key={index}
            type="button"
            onClick={() => (isDelete ? onDelete() : onPress(key))}
            aria-label={isDelete ? "Delete" : key}
            className={cn(
              "grid min-h-12 place-items-center rounded-field text-lg font-medium text-white",
              "bg-white/8 tabular font-mono",
              // 130ms so the press resolves before the finger lifts. Anything
              // slower on a keypad reads as lag rather than as feedback.
              "transition-[background-color,transform] duration-[var(--duration-instant)] ease-out-strong",
              "hover:bg-white/15 active:scale-[0.94] active:bg-white/20",
            )}
          >
            {isDelete ? <Delete className="size-5" aria-hidden /> : key}
          </button>
        );
      })}
    </div>
  );
}
