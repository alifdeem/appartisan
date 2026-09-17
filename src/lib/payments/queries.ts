import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PaymentLeg, PaymentRow } from "@/lib/supabase/types";

/**
 * Payment reads.
 *
 * Session-bound, so RLS decides. `payments` is read-only to every end user —
 * rows are written exclusively by server code holding the service role, driven
 * by the provider's webhook (migration 0003). Nothing in this file can change a
 * payment, and that is the point: a client's screen reports what the provider
 * said, it never asserts it.
 */

export async function listJobPayments(jobId: string): Promise<PaymentRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[payments] listJobPayments failed:", error.message, error.details ?? "");
    return [];
  }

  return data ?? [];
}

/**
 * The state of one leg, collapsed to what a screen needs to decide.
 *
 * A leg can have several attempts — the partial unique index in 0012 allows any
 * number of failures and exactly one success — so "has this been paid?" is a
 * question about the set, not about the newest row.
 */
export interface LegState {
  /** The successful payment, if there is one. Authoritative. */
  paid: PaymentRow | null;
  /** An attempt currently in flight, if any. */
  pending: PaymentRow | null;
  /** The most recent failure, for showing why the last try did not work. */
  lastFailure: PaymentRow | null;
  attempts: number;
}

export function legState(payments: PaymentRow[], leg: PaymentLeg): LegState {
  const forLeg = payments.filter((payment) => payment.leg === leg);

  return {
    paid: forLeg.find((payment) => payment.status === "succeeded") ?? null,
    pending:
      forLeg.find((payment) => payment.status === "pending" || payment.status === "processing") ??
      null,
    lastFailure: forLeg.find((payment) => payment.status === "failed") ?? null,
    attempts: forLeg.length,
  };
}

/**
 * What the client owes on the deposit, from the accepted quote.
 *
 * Through the RPC rather than recomputed here. The quote is the agreement, and
 * recomputing it at charge time means a commission change between acceptance
 * and payment silently alters what somebody agreed to pay.
 */
export async function getDepositDue(jobId: string): Promise<number | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("deposit_due_for_job", { p_job_id: jobId });

  if (error) {
    console.error("[payments] getDepositDue failed:", error.message);
    return null;
  }

  return data === null ? null : Number(data);
}

/** One payment by its provider reference — for the simulated MoMo screen. */
export async function getPaymentByReference(reference: string): Promise<PaymentRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("provider_reference", reference)
    .maybeSingle();

  if (error) {
    console.error("[payments] getPaymentByReference failed:", error.message);
    return null;
  }

  return data ?? null;
}
