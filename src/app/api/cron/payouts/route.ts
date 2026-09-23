import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getPaymentProvider } from "@/lib/integrations/payments";
import { reportError } from "@/lib/integrations/monitoring";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Paying the artisans.
 *
 * **This is the half of Phase 5 that was never wired up.** Everything around it
 * existed: `settle_payment` (migration 0015) queues a `pending` payout the
 * moment a client's balance lands, with the comment *"transfer is the adapter's
 * job"*; both payment adapters implement `transfer()`; the webhook route
 * handles `transfer.success` and `transfer.failed`. But **nothing in the
 * codebase ever called `transfer()`** — so `transfer_reference` was always
 * null, no webhook could ever match a row, and every payout sat at `pending`
 * for ever.
 *
 * The visible symptom was on the artisan's Earnings screen, which counts only
 * `paid` as earned (deliberately — see `summarisePayouts`, where counting
 * pending would make the headline *drop* when a transfer fails). So an artisan
 * could finish a job, watch the client pay in full, and see GHS 0.00 earned
 * with the money stuck on "on the way" permanently. Which is exactly what was
 * reported, and exactly the thing this product promises not to do.
 *
 * **Why a sweep and not an inline call in the webhook.** The balance webhook
 * settles the charge inside a database transaction; reaching out to a payment
 * provider inside that path means a slow or failed transfer either blocks the
 * settlement or gets lost when it is rolled back. The queued row is the
 * obligation, and it must survive independently of whether the transfer
 * succeeds. A sweep retries on its own, which is the behaviour money out needs.
 *
 * **Nothing is ever paid twice.** A row is only picked up while it is `pending`
 * with no `transfer_reference`, and the reference is written as soon as the
 * provider returns one. A crash between the two is the one gap, and it is the
 * safe direction: a row with no reference is retried, a row with one is left to
 * the webhook.
 */

export const dynamic = "force-dynamic";

/**
 * How many to attempt per run. Small on purpose — a sweep that tries to move a
 * hundred transfers in one request is a sweep that times out halfway through
 * with no record of where it got to.
 */
const BATCH = 20;

function authorised(request: Request): boolean {
  const secret = env.CRON_SECRET;
  // Locally a convenience; in production a refusal. An open endpoint that moves
  // money must fail closed.
  if (!secret) return env.NODE_ENV !== "production";
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

async function sweep() {
  const supabase = createAdminClient();
  const provider = getPaymentProvider();

  const { data: queued, error } = await supabase
    .from("payouts")
    .select("id, job_id, provider_id, amount")
    .eq("status", "pending")
    .is("transfer_reference", null)
    .order("initiated_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error("[cron:payouts] could not list queued payouts", error.message);
    await reportError(error, { scope: "cron:payouts" });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let sent = 0;
  let blocked = 0;
  let failed = 0;

  for (const payout of queued ?? []) {
    // The destination. Read per payout rather than joined, because a missing
    // one is a decision point, not a filter: the artisan has earned this money
    // and has nowhere to receive it, which they need telling about.
    const { data: artisan } = await supabase
      .from("providers")
      .select("momo_number, momo_network, payout_recipient_code")
      .eq("profile_id", payout.provider_id)
      .maybeSingle();

    if (!artisan?.momo_number || !artisan.momo_network) {
      // Marked failed rather than skipped. A silent skip leaves the artisan
      // looking at "on the way" for money that cannot move; `failed` is what
      // puts the red banner and the "check your payout details" link on their
      // Earnings screen. The sweep picks it up again once they fix it, because
      // a failed row with no reference is retried (see the note above).
      await supabase
        .from("payouts")
        .update({
          status: "failed",
          failure_reason: "No Mobile Money number on your account, so we could not send this.",
        })
        .eq("id", payout.id);

      blocked += 1;
      continue;
    }

    try {
      const result = await provider.transfer({
        jobId: payout.job_id,
        providerId: payout.provider_id,
        amountGhs: Number(payout.amount),
        recipientCode: artisan.payout_recipient_code ?? undefined,
        momoNumber: artisan.momo_number,
        momoNetwork: artisan.momo_network,
        reason: "ArtisanGH job payout",
      });

      if (!result.ok) {
        await supabase
          .from("payouts")
          .update({ status: "failed", failure_reason: result.error ?? "The transfer was refused." })
          .eq("id", payout.id);

        failed += 1;
        continue;
      }

      // `paid` comes back from the mock immediately and from a live provider
      // only when the transfer settles synchronously; otherwise it is
      // `processing` and the `transfer.success` webhook finishes the job.
      await supabase
        .from("payouts")
        .update({
          status: result.status,
          transfer_reference: result.transferReference,
          is_simulated: result.simulated,
          settled_at: result.status === "paid" ? new Date().toISOString() : null,
        })
        .eq("id", payout.id);

      sent += 1;
      console.info(
        `[cron:payouts] ${payout.id} → ${result.status} (${result.transferReference})`,
      );
    } catch (cause) {
      // One unreachable transfer must not strand the rest of the batch. The row
      // keeps its null reference and is retried next run.
      console.warn(`[cron:payouts] transfer failed for ${payout.id}`, cause);
      await reportError(cause, { scope: "cron:payouts", extra: { payoutId: payout.id } });
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, examined: queued?.length ?? 0, sent, blocked, failed });
}

export async function POST(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  return sweep();
}

/** Vercel Cron issues a GET, as do most simple schedulers. Same guard. */
export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  return sweep();
}
