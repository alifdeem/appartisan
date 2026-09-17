import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getPaymentProvider } from "@/lib/integrations/payments";
import { reportError } from "@/lib/integrations/monitoring";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Payment reconciliation.
 *
 * A charge that was initialised and never heard about again is the failure mode
 * PLAN.md §13 names directly: the webhook did not arrive, or arrived and was
 * lost. Webhooks are best-effort — providers retry, but retries expire, and a
 * deploy at the wrong moment eats one. Without a sweep, that client paid and
 * their job sits in `awaiting_deposit` forever.
 *
 * So this asks the provider rather than guessing:
 *
 *   1. Find charges still pending after `RECONCILE_AFTER_MINUTES`.
 *   2. `verifyCharge` each one — the provider is the authority on its own money.
 *   3. Feed the answer through `settle_payment`, the same function the webhook
 *      uses, so a recovered charge advances the job identically.
 *
 * **Nothing is decided from a timeout.** A charge that is *still* pending after
 * `ABANDON_AFTER_MINUTES` is marked failed, and that is safe only because
 * failing a charge takes nothing from anybody — it releases the job to be paid
 * again. The reverse guess would be inventing money.
 *
 * Runs less often than the offer sweep because the webhook is the primary path
 * and this is the net beneath it.
 */

export const dynamic = "force-dynamic";

/** Long enough that a slow-but-working webhook is never second-guessed. */
const RECONCILE_AFTER_MINUTES = 15;

/** Past this, a prompt nobody approved is a prompt nobody is going to approve. */
const ABANDON_AFTER_MINUTES = 60;

function authorised(request: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return env.NODE_ENV !== "production";
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

async function reconcile() {
  const supabase = createAdminClient();
  const provider = getPaymentProvider();

  const { data: stale, error } = await supabase.rpc("stale_pending_payments", {
    p_older_than_minutes: RECONCILE_AFTER_MINUTES,
  });

  if (error) {
    console.error("[cron:payments] could not list stale payments", error.message);
    await reportError(error, { scope: "cron:payments" });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let settled = 0;
  let abandoned = 0;
  let stillPending = 0;

  for (const payment of stale ?? []) {
    const ageMinutes = (Date.now() - new Date(payment.created_at).getTime()) / 60_000;

    try {
      const status = await provider.verifyCharge(payment.provider_reference);

      if (status.status === "succeeded" || status.status === "failed") {
        await supabase.rpc("settle_payment", {
          p_reference: payment.provider_reference,
          p_succeeded: status.status === "succeeded",
          p_reason: status.status === "failed" ? "Reconciled from the provider" : null,
          p_channel: status.channel ?? null,
        });

        settled += 1;
        console.info(
          `[cron:payments] reconciled ${payment.provider_reference} → ${status.status}`,
        );
        continue;
      }

      if (ageMinutes >= ABANDON_AFTER_MINUTES) {
        await supabase.rpc("settle_payment", {
          p_reference: payment.provider_reference,
          p_succeeded: false,
          p_reason: "No response from the payment prompt. Nothing was charged.",
          p_channel: null,
        });

        abandoned += 1;
        continue;
      }

      stillPending += 1;
    } catch (cause) {
      // One unreachable reference must not strand the rest of the sweep. It
      // stays pending and is picked up on the next run.
      console.warn(`[cron:payments] could not verify ${payment.provider_reference}`, cause);
      stillPending += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    examined: stale?.length ?? 0,
    settled,
    abandoned,
    stillPending,
  });
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return reconcile();
}

/** Vercel Cron issues a GET, as do most simple schedulers. Same guard. */
export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return reconcile();
}
