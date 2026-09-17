"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MockPaymentProvider } from "@/lib/integrations/payments/mock";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { SimulatedOutcome } from "@/lib/integrations/payments/types";

/**
 * Driving a simulated charge to its conclusion.
 *
 * This is the one action in the codebase that exists purely for the simulation,
 * so it carries three refusals rather than one:
 *
 *  1. **It refuses unless the payment provider is actually `mock`.** If this
 *     shipped reachable against Paystack it would be an endpoint that settles
 *     real charges on request.
 *  2. **It refuses unless the caller owns the job.** RLS already hides other
 *     people's payments, but this reads by provider reference — a value that
 *     travels in a URL — so ownership is re-checked rather than assumed.
 *  3. **It does not settle anything itself.** It asks the mock provider to sign
 *     a payload and POST it to `/api/webhooks/payments` over real HTTP. The
 *     money decision is made by the same handler Paystack will call, running
 *     the same `settle_payment` transaction.
 *
 * That third point is the entire reason PLAN.md §3 insists the mock fire a
 * webhook rather than resolve inline: it means the asynchronous half of the
 * payment system — signature checks, idempotency, out-of-order delivery — is
 * exercised on every demo, months before real money touches it.
 */

export interface SimulateState {
  ok: boolean;
  error?: string;
  token: string;
}

function state(value: Omit<SimulateState, "token">): SimulateState {
  return { ...value, token: randomUUID() };
}

const schema = z.object({
  reference: z.string().trim().min(6).max(120),
  outcome: z.enum(["success", "failed", "timeout", "insufficient_funds"]),
});

export async function settleSimulatedChargeAction(
  reference: string,
  outcome: SimulatedOutcome,
): Promise<SimulateState> {
  const parsed = schema.safeParse({ reference, outcome });
  if (!parsed.success) return state({ ok: false, error: "That payment could not be found." });

  if (env.PAYMENT_PROVIDER !== "mock") {
    return state({ ok: false, error: "Simulated payments are switched off." });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return state({ ok: false, error: "You need to be signed in." });

  // Read through the session, so RLS decides whether this person may see the
  // payment at all. `payments: participants read` scopes it to the job.
  const { data: payment } = await supabase
    .from("payments")
    .select("id, job_id, status")
    .eq("provider_reference", parsed.data.reference)
    .maybeSingle();

  if (!payment) return state({ ok: false, error: "That payment could not be found." });

  const { data: job } = await supabase
    .from("jobs")
    .select("client_id")
    .eq("id", payment.job_id)
    .maybeSingle();

  if (!job || job.client_id !== user.id) {
    return state({ ok: false, error: "That payment is not yours." });
  }

  if (payment.status === "succeeded") {
    // Not an error — a double tap, or a reload after the webhook already
    // landed. The screen will show the success it is asking to produce.
    return state({ ok: true });
  }

  try {
    // Deliberately the concrete class, not `getPaymentProvider()`. `settleCharge`
    // is not part of the `PaymentProvider` port — no real provider has such a
    // method, and putting one on the interface would invite production code to
    // depend on being able to settle its own charges.
    await new MockPaymentProvider().settleCharge(parsed.data.reference, parsed.data.outcome);
  } catch (error) {
    console.error("[payments:simulate] settle failed", error);
    return state({
      ok: false,
      error: "The simulated network did not answer. Try again.",
    });
  }

  revalidatePath(`/client/jobs/${payment.job_id}`);
  return state({ ok: true });
}

/**
 * Has the webhook landed yet?
 *
 * The screen polls this rather than trusting its own "I just approved it",
 * because the webhook is a separate HTTP round trip that can be slow, retried,
 * or lost. A payment screen that says "paid" on the strength of a button press
 * is exactly the lie this simulation exists to avoid teaching.
 */
export async function pollPaymentStatusAction(
  reference: string,
): Promise<{ status: string; jobId: string | null; failureReason: string | null }> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select("status, job_id, failure_reason")
    .eq("provider_reference", reference)
    .maybeSingle();

  return {
    status: data?.status ?? "unknown",
    jobId: data?.job_id ?? null,
    failureReason: data?.failure_reason ?? null,
  };
}
