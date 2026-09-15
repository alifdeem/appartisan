import { NextResponse } from "next/server";

import { getPaymentProvider } from "@/lib/integrations/payments";
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
    case "charge.success": {
      // Idempotent by reference. Providers retry, and a double-credited deposit
      // is a support ticket that costs more than the job is worth.
      const { data: payment } = await admin
        .from("payments")
        .select("id, status")
        .eq("provider_reference", event.reference)
        .maybeSingle();

      if (!payment) {
        console.warn("[webhook:payments] no payment row for", event.reference);
        return NextResponse.json({ received: true, handled: false });
      }

      if (payment.status === "succeeded") {
        return NextResponse.json({ received: true, handled: true, idempotent: true });
      }

      await admin
        .from("payments")
        .update({
          status: "succeeded",
          paid_at: now,
          channel: event.channel ?? null,
          raw_payload: raw,
        })
        .eq("id", payment.id);

      // Advancing the job's own status belongs to the payments phase — the
      // state machine lands in Phase 4 (PLAN.md §6, §12).
      break;
    }

    case "charge.failed": {
      await admin
        .from("payments")
        .update({
          status: "failed",
          failure_reason: event.failureReason ?? "Payment failed",
          raw_payload: raw,
        })
        .eq("provider_reference", event.reference);
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
