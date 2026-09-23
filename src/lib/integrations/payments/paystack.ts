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
  type TransferInput,
  type TransferResult,
} from "./types";

/**
 * Live payments via Paystack.
 *
 * NOT YET EXERCISED — written so the shape is settled and the switch-over is a
 * config change, but no real transaction has ever gone through it. Treat the
 * first live charge as a genuine test (PLAN.md §3 budgets a week for this).
 *
 * Note what is deliberately ABSENT: no `subaccount`, no `split_code`. Charges
 * land wholly in the platform's Paystack balance and artisans are paid with a
 * separate Transfer. See types.ts for why.
 *
 * Requires Manual Payouts enabled on the Paystack account so the balance can
 * hold between collection and payout. Paystack requires at least one transfer
 * every 90 days to keep that mode active.
 */

const API = "https://api.paystack.co";

interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
}

export class PaystackPaymentProvider implements PaymentProvider {
  readonly name = "paystack";
  readonly simulated = false;

  private async call<T>(path: string, init?: RequestInit): Promise<PaystackEnvelope<T>> {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    const payload = (await response.json()) as PaystackEnvelope<T>;

    if (!response.ok || !payload.status) {
      throw new Error(`[paystack] ${path} failed: ${payload.message ?? response.status}`);
    }

    return payload;
  }

  async initializeCharge(input: InitializeChargeInput): Promise<ChargeInitResult> {
    // Paystack requires an email. Ghanaian users sign in by phone and many have
    // no email, so synthesise a stable one from the phone number.
    const email = input.customerEmail ?? `${input.customerPhone.replace("+", "")}@phone.artisangh.app`;

    const { data } = await this.call<{ reference: string; authorization_url: string }>(
      "/transaction/initialize",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          amount: toPesewas(input.amountGhs),
          currency: "GHS",
          channels: input.channel === "momo" ? ["mobile_money"] : [input.channel],
          metadata: {
            job_id: input.jobId,
            leg: input.leg,
            phone: input.customerPhone,
            ...input.metadata,
          },
        }),
      },
    );

    const supabase = createAdminClient();
    const { error } = await supabase.from("payments").insert({
      job_id: input.jobId,
      leg: input.leg,
      amount: input.amountGhs,
      status: "pending",
      channel: input.channel,
      momo_network: input.momoNetwork ?? null,
      provider_reference: data.reference,
      is_simulated: false,
    });

    if (error) {
      throw new Error(`[paystack] charge initialised but not recorded: ${error.message}`);
    }

    return { reference: data.reference, authorizationUrl: data.authorization_url, simulated: false };
  }

  async verifyCharge(reference: string): Promise<ChargeStatusResult> {
    const { data } = await this.call<{
      reference: string;
      status: string;
      amount: number;
      channel: string;
      paid_at: string | null;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);

    const status =
      data.status === "success" ? "succeeded" : data.status === "failed" ? "failed" : "pending";

    return {
      reference: data.reference,
      status,
      amountGhs: fromPesewas(data.amount),
      channel: data.channel as ChargeStatusResult["channel"],
      paidAt: data.paid_at ?? undefined,
      raw: data,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    try {
      const { data } = await this.call<{ id: number }>("/refund", {
        method: "POST",
        body: JSON.stringify({
          transaction: input.reference,
          ...(input.amountGhs ? { amount: toPesewas(input.amountGhs) } : {}),
          merchant_note: input.reason,
        }),
      });

      return {
        ok: true,
        reference: input.reference,
        refundReference: String(data.id),
        simulated: false,
      };
    } catch (error) {
      return {
        ok: false,
        reference: input.reference,
        simulated: false,
        error: error instanceof Error ? error.message : "unknown error",
      };
    }
  }

  async transfer(input: TransferInput): Promise<TransferResult> {
    try {
      // A recipient must exist before money can be sent. Created on first payout
      // and cached on the provider row thereafter.
      let recipientCode = input.recipientCode;

      if (!recipientCode) {
        const { data } = await this.call<{ recipient_code: string }>("/transferrecipient", {
          method: "POST",
          body: JSON.stringify({
            type: "mobile_money",
            name: `ArtisanGH provider ${input.providerId}`,
            account_number: input.momoNumber.replace("+233", "0"),
            // NOTE: Paystack still labels Telecel as "VOD" in its bank list.
            // Verify the current code before go-live.
            bank_code: { mtn: "MTN", telecel: "VOD", airteltigo: "ATL" }[input.momoNetwork],
            currency: "GHS",
          }),
        });

        recipientCode = data.recipient_code;

        const supabase = createAdminClient();
        await supabase
          .from("providers")
          .update({ payout_recipient_code: recipientCode })
          .eq("profile_id", input.providerId);
      }

      const { data } = await this.call<{ transfer_code: string; status: string }>("/transfer", {
        method: "POST",
        body: JSON.stringify({
          source: "balance",
          amount: toPesewas(input.amountGhs),
          recipient: recipientCode,
          currency: "GHS",
          reason: input.reason ?? `ArtisanGH job payout`,
        }),
      });

      // No `payouts` write here. `settle_payment` already queued the row this
      // transfer is against, and the caller records the outcome on it — an
      // adapter that inserts its own produces two rows for one job. See the
      // note on the mock adapter's `transfer`.
      return {
        ok: true,
        transferReference: data.transfer_code,
        status: data.status === "success" ? "paid" : "processing",
        simulated: false,
      };
    } catch (error) {
      return {
        ok: false,
        transferReference: "",
        status: "failed",
        simulated: false,
        error: error instanceof Error ? error.message : "unknown error",
      };
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    if (!signature) return false;

    const secret = env.PAYSTACK_WEBHOOK_SECRET ?? env.PAYSTACK_SECRET_KEY;
    if (!secret) return false;

    const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhook(rawBody: string): PaymentWebhookEvent | null {
    try {
      const payload = JSON.parse(rawBody) as {
        event: string;
        data: {
          reference?: string;
          transfer_code?: string;
          amount: number;
          channel?: string;
          gateway_response?: string;
        };
      };

      const reference = payload.data.reference ?? payload.data.transfer_code;
      if (!reference) return null;

      return {
        type: payload.event as PaymentWebhookEvent["type"],
        reference,
        amountGhs: fromPesewas(payload.data.amount),
        channel: payload.data.channel as PaymentWebhookEvent["channel"],
        failureReason: payload.data.gateway_response,
        raw: payload,
      };
    } catch {
      return null;
    }
  }
}
