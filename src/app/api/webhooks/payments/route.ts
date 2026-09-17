import { NextResponse } from "next/server";

import { getPaymentProvider } from "@/lib/integrations/payments";
import { reportError, reportMessage } from "@/lib/integrations/monitoring";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Payment webhook.
 *
 * The single place a payment is allowed to change state. Neither the client nor
 * the artisan can mark a payment paid — the callback screen only ever *reads*.
 * That is the difference between "the user says they paid" and "the provider
 * says they paid".
 *
 * The mock provider POSTs here over real HTTP with a real HMAC signature, so
 * this handler is exercised on every simulated payment and will already have
 * plenty of mileage by the time Paystack starts calling it for real.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const provider = getPaymentProvider();

  // The raw body, byte for byte. Parsing first and re-stringifying changes key
  // order and whitespace, and the signature stops matching.
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-paystack-signature") ?? request.headers.get("x-webhook-signature");

  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    console.warn("[webhook:payments] rejected — bad signature");
    // Worth aggregating: one of these is a misconfigured secret, a run of them
    // is somebody probing the endpoint.
    await reportMessage("payment webhook rejected — bad signature", {
      scope: "webhook:payments",
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = provider.parseWebhook(rawBody);
  if (!event) {
    // 200, deliberately: an event shape we do not handle is not a failure, and
    // a non-200 makes Paystack retry it on a schedule for days.
    return NextResponse.json({ received: true, handled: false });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const raw = event.raw as never;

  switch (event.type) {
    case "charge.success":
    case "charge.failed": {
      const succeeded = event.type === "charge.success";

      /**
       * One RPC for both outcomes, because the payment row and the job status
       * have to move together or not at all.
       *
       * Doing it here in two statements — update the payment, then update the
       * job — leaves a window where a crash between them produces a paid
       * deposit on a job still asking to be paid. `settle_payment` does both in
       * one transaction, takes the row locks in a fixed order, and is
       * idempotent by reference, so a provider's retry is a no-op rather than a
       * double credit.
       */
      const { data: jobStatus, error } = await admin.rpc("settle_payment", {
        p_reference: event.reference,
        p_succeeded: succeeded,
        p_reason: succeeded ? null : (event.failureReason ?? "Payment failed"),
        p_channel: event.channel ?? null,
      });

      if (error) {
        // 500 so the provider retries. This is the one case where a retry is
        // what we want — the event was real and we failed to act on it.
        console.error("[webhook:payments] settle_payment failed", error.message);
        // The provider says money moved and we failed to record it. Everything
        // downstream — the job status, the payout, the invoice — is now wrong
        // until this is resolved, so it is the single loudest thing here.
        await reportError(error, {
          scope: "webhook:payments",
          extra: { reference: event.reference, event: event.type },
        });
        return NextResponse.json({ error: "could not settle" }, { status: 500 });
      }

      // The raw provider payload is stored separately from the settlement so a
      // failure to record it can never roll back the money decision.
      await admin
        .from("payments")
        .update({ raw_payload: raw })
        .eq("provider_reference", event.reference);

      console.info(
        `[webhook:payments] ${event.type} ${event.reference} → job ${jobStatus ?? "unknown"}`,
      );
      break;
    }

    case "refund.processed": {
      await admin
        .from("payments")
        .update({ status: "refunded", raw_payload: raw })
        .eq("provider_reference", event.reference);
      break;
    }

    case "transfer.success": {
      await admin
        .from("payouts")
        .update({ status: "paid", settled_at: now, raw_payload: raw })
        .eq("transfer_reference", event.reference);
      break;
    }

    case "transfer.failed": {
      await admin
        .from("payouts")
        .update({
          status: "failed",
          failure_reason: event.failureReason ?? "Transfer failed",
          raw_payload: raw,
        })
        .eq("transfer_reference", event.reference);
      break;
    }
  }

  return NextResponse.json({ received: true, handled: true });
}

/** Paystack pings this when you save the webhook URL in their dashboard. */
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "payments" });
}
