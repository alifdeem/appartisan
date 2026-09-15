import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fromPesewas,
  toPesewas,
  type ChargeInitResult,
  type ChargeStatusResult,
  type InitializeChargeInput,
  type PaymentProvider,
  type PaymentWebhookEvent,
  type RefundInput,
  type RefundResult,
  type SimulatedOutcome,
  type TransferInput,
  type TransferResult,
} from "./types";

/**
 * Simulated payments.
 *
 * THE IMPORTANT PART: settling a mock charge does not resolve inline. It signs
 * a payload and POSTs it to our own /api/webhooks/payments endpoint — the same
 * handler Paystack will call in production.
 *
 * If the mock resolved the charge with a direct function return, the entire
 * asynchronous half of the payment system (signature verification, idempotency,
 * out-of-order delivery, retries) would stay unwritten and untested until the
 * day real money was involved. Which is the worst possible day to discover it
 * does not work. See PLAN.md §3.
 */

/** Local-only. Stands in for PAYSTACK_WEBHOOK_SECRET so the signing path is real. */
const MOCK_WEBHOOK_SECRET = "artisangh-mock-webhook-secret";

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  readonly simulated = true;

  async initializeCharge(input: InitializeChargeInput): Promise<ChargeInitResult> {
    const reference = `mock_chg_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const supabase = createAdminClient();

    const { error } = await supabase.from("payments").insert({
      job_id: input.jobId,
      leg: input.leg,
      amount: input.amountGhs,
      status: "pending",
      channel: input.channel,
      momo_network: input.momoNetwork ?? null,
      provider_reference: reference,
      is_simulated: true,
      raw_payload: { initialized: input, amount_pesewas: toPesewas(input.amountGhs) },
    });

    if (error) {
      throw new Error(`[payments:mock] could not record charge: ${error.message}`);
    }

    return {
      reference,
      // Our own simulated MoMo prompt screen. Built in Phase 4.
      authorizationUrl: `${env.NEXT_PUBLIC_APP_URL}/pay/simulate/${reference}`,
      simulated: true,
    };
  }

  async verifyCharge(reference: string): Promise<ChargeStatusResult> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("payments")
      .select("provider_reference, status, amount, channel, paid_at")
      .eq("provider_reference", reference)
      .single();

    if (error || !data) {
      throw new Error(`[payments:mock] unknown reference ${reference}`);
    }

    return {
      reference: data.provider_reference,
      status: data.status,
      amountGhs: Number(data.amount),
      channel: (data.channel ?? undefined) as ChargeStatusResult["channel"],
      paidAt: data.paid_at ?? undefined,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, status")
      .eq("provider_reference", input.reference)
      .single();

    if (error || !data) {
      return { ok: false, reference: input.reference, simulated: true, error: "unknown reference" };
    }

    if (data.status !== "succeeded") {
      return {
        ok: false,
        reference: input.reference,
        simulated: true,
        error: `cannot refund a charge in status "${data.status}"`,
      };
    }

    await supabase
      .from("payments")
      .update({ status: "refunded", failure_reason: input.reason ?? null })
      .eq("id", data.id);

    return {
      ok: true,
      reference: input.reference,
      refundReference: `mock_rfn_${crypto.randomUUID().slice(0, 12)}`,
      simulated: true,
    };
  }

  async transfer(input: TransferInput): Promise<TransferResult> {
    const transferReference = `mock_trf_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const supabase = createAdminClient();

    const { error } = await supabase.from("payouts").insert({
      job_id: input.jobId,
      provider_id: input.providerId,
      amount: input.amountGhs,
      status: "paid",
      transfer_reference: transferReference,
      is_simulated: true,
      settled_at: new Date().toISOString(),
      raw_payload: {
        momo_number: input.momoNumber,
        momo_network: input.momoNetwork,
        reason: input.reason ?? null,
      },
    });

    if (error) {
      return {
        ok: false,
        transferReference,
        status: "failed",
        simulated: true,
        error: error.message,
      };
    }

    return { ok: true, transferReference, status: "paid", simulated: true };
  }

  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    if (!signature) return false;
    const expected = createHmac("sha512", MOCK_WEBHOOK_SECRET).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhook(rawBody: string): PaymentWebhookEvent | null {
    try {
      const payload = JSON.parse(rawBody) as {
        event: string;
        data: {
          reference: string;
          amount: number;
          channel?: string;
          gateway_response?: string;
        };
      };

      return {
        type: payload.event as PaymentWebhookEvent["type"],
        reference: payload.data.reference,
        amountGhs: fromPesewas(payload.data.amount),
        channel: payload.data.channel as PaymentWebhookEvent["channel"],
        failureReason: payload.data.gateway_response,
        raw: payload,
      };
    } catch {
      return null;
    }
  }

  /**
   * Drive a simulated charge to its conclusion.
   *
   * Called by the mock MoMo prompt screen (Phase 4) and by the dev panel. Signs
   * a Paystack-shaped payload and delivers it to our own webhook endpoint over
   * real HTTP, so the production code path is what actually runs.
   */
  async settleCharge(reference: string, outcome: SimulatedOutcome = "success"): Promise<void> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("payments")
      .select("amount")
      .eq("provider_reference", reference)
      .single();

    if (error || !data) {
      throw new Error(`[payments:mock] cannot settle unknown reference ${reference}`);
    }

    const succeeded = outcome === "success";
    const gatewayResponse = {
      success: "Approved",
      failed: "Declined by financial institution",
      timeout: "Transaction timed out waiting for customer approval",
      insufficient_funds: "Insufficient funds",
    }[outcome];

    const body = JSON.stringify({
      event: succeeded ? "charge.success" : "charge.failed",
      data: {
        reference,
        amount: toPesewas(Number(data.amount)),
        currency: "GHS",
        channel: "mobile_money",
        gateway_response: gatewayResponse,
        paid_at: new Date().toISOString(),
        simulated: true,
      },
    });

    const signature = createHmac("sha512", MOCK_WEBHOOK_SECRET).update(body).digest("hex");

    const response = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/webhooks/payments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-paystack-signature": signature,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `[payments:mock] webhook delivery failed with ${response.status}: ${await response.text()}`,
      );
    }
  }
}
