/**
 * Phase 5 end-to-end: travel, work, sign-off, balance, payout, close.
 *
 * Picks up where `e2e-payments.ts` stops — a job at `deposit_paid` — and drives
 * it to `closed`, then walks the cancellation ladder from PLAN.md §7 on
 * separate jobs because each tier is terminal.
 *
 * Needs the dev server up: the balance leg settles through the same signed
 * webhook the deposit does.
 *
 *   npm run dev              # in another terminal
 *   npm run e2e:execution
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CLIENT_PHONE = "+233241111111";
const ARTISAN_PHONE = "+233242222242";
const JOB_POINT = { lng: -0.1805, lat: 5.5561 };
const MOCK_WEBHOOK_SECRET = "artisangh-mock-webhook-secret";

let failures = 0;
function check(name: string, pass: boolean, detail: string) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!pass) failures++;
}

const syntheticEmail = (e164: string) => `${e164.replace("+", "")}@phone.artisangh.app`;

async function sessionFor(phone: string): Promise<{ db: SupabaseClient; id: string }> {
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: syntheticEmail(phone),
  });
  if (error || !link?.properties?.hashed_token) {
    throw new Error(`session for ${phone}: ${error?.message}`);
  }

  const auth = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error: verifyError } = await auth.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError || !data.session) throw new Error(`verify ${phone}: ${verifyError?.message}`);

  return {
    id: data.user!.id,
    db: createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    }),
  };
}

async function jobStatus(jobId: string): Promise<string> {
  const { data } = await admin.from("jobs").select("status").eq("id", jobId).single();
  return data?.status ?? "??";
}

async function settle(reference: string, amountGhs: number, succeeded = true) {
  const body = JSON.stringify({
    event: succeeded ? "charge.success" : "charge.failed",
    data: {
      reference,
      amount: Math.round(amountGhs * 100),
      currency: "GHS",
      channel: "mobile_money",
      gateway_response: succeeded ? "Approved" : "Declined",
      paid_at: new Date().toISOString(),
    },
  });

  return fetch(`${appUrl}/api/webhooks/payments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-paystack-signature": createHmac("sha512", MOCK_WEBHOOK_SECRET).update(body).digest("hex"),
    },
    body,
  });
}

async function charge(jobId: string, leg: "deposit" | "balance", amountGhs: number) {
  const reference = `mock_chg_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const { error } = await admin.from("payments").insert({
    job_id: jobId,
    leg,
    amount: amountGhs,
    status: "pending",
    channel: "momo",
    momo_network: "mtn",
    provider_reference: reference,
    is_simulated: true,
  });
  if (error) throw new Error(`charge ${leg}: ${error.message}`);
  return reference;
}

/** A job at `deposit_paid`, the state Phase 5 inherits. */
async function jobAtDepositPaid(client: { db: SupabaseClient; id: string }) {
  const { data: category } = await admin
    .from("categories")
    .select("id")
    .eq("slug", "electrical")
    .single();

  const { data: draft, error } = await client.db
    .from("jobs")
    .insert({ client_id: client.id, category_id: category!.id })
    .select("id, reference")
    .single();
  if (error || !draft) throw new Error(`draft: ${error?.message}`);

  const jobId = draft.id as string;

  await client.db.rpc("set_job_location", {
    p_job_id: jobId,
    p_lng: JOB_POINT.lng,
    p_lat: JOB_POINT.lat,
    p_address_text: "Osu, Accra",
    p_ghanapost_code: null,
    p_landmark: "Blue gate opposite the pharmacy",
  });
  await client.db.from("jobs").update({ description: "Kitchen sockets dead." }).eq("id", jobId);
  await client.db.rpc("post_job", { p_job_id: jobId });

  const { data: offer } = await admin
    .from("job_offers")
    .select("id, provider_id")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .limit(1)
    .single();

  const { data: holderProfile } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", offer!.provider_id)
    .single();

  const artisan = await sessionFor(holderProfile!.phone);
  await artisan.db.rpc("respond_to_offer", { p_offer_id: offer!.id, p_accept: true });

  const quote = await artisan.db.rpc("save_quote", {
    p_job_id: jobId,
    p_items: [{ kind: "labour", description: "Replace two sockets", quantity: 1, unit_price: 320 }],
    p_notes: null,
  });
  await artisan.db.rpc("send_quote", { p_quote_id: quote.data });
  await client.db.rpc("respond_to_quote", {
    p_quote_id: quote.data,
    p_accept: true,
    p_reason: null,
  });

  const depositRef = await charge(jobId, "deposit", 199.2);
  await settle(depositRef, 199.2);

  return { jobId, artisan, reference: draft.reference as string };
}

async function addCompletionPhoto(jobId: string, providerId: string) {
  await admin.from("job_photos").insert({
    job_id: jobId,
    storage_path: `${jobId}/completion-${crypto.randomUUID()}.jpg`,
    stage: "completion",
    uploaded_by: providerId,
  });
}

async function cleanup(jobIds: string[]) {
  for (const jobId of jobIds) {
    await admin.from("payouts").delete().eq("job_id", jobId);
    await admin.from("payments").delete().eq("job_id", jobId);
    await admin.from("jobs").delete().eq("id", jobId);
  }
}

async function main() {
  const created: string[] = [];

  try {
    const client = await sessionFor(CLIENT_PHONE);

    // ---- the happy path ----------------------------------------------------
    console.log("\n  Travelling and working\n");

    const { jobId, artisan } = await jobAtDepositPaid(client);
    created.push(jobId);

    check(
      "job starts at deposit_paid",
      (await jobStatus(jobId)) === "deposit_paid",
      `status is ${await jobStatus(jobId)}`,
    );

    const skip = await artisan.db.rpc("advance_job_execution", {
      p_job_id: jobId,
      p_to: "in_progress",
    });
    check(
      "an artisan cannot skip straight to working",
      skip.error !== null,
      skip.error ? `blocked: ${skip.error.message.slice(0, 55)}` : "NOT BLOCKED",
    );

    const clientDrives = await client.db.rpc("advance_job_execution", {
      p_job_id: jobId,
      p_to: "en_route",
    });
    check(
      "a client cannot drive the artisan's status",
      clientDrives.error !== null,
      clientDrives.error ? `blocked: ${clientDrives.error.message.slice(0, 40)}` : "NOT BLOCKED",
    );

    for (const to of ["en_route", "arrived", "in_progress"] as const) {
      const step = await artisan.db.rpc("advance_job_execution", { p_job_id: jobId, p_to: to });
      check(`artisan moves to ${to}`, step.error === null && step.data === to, step.error?.message ?? to);
    }

    const { data: onJob } = await admin
      .from("providers")
      .select("availability")
      .eq("profile_id", artisan.id)
      .single();
    check(
      "travelling takes the artisan out of the matching pool",
      onJob?.availability === "on_job",
      `availability is ${onJob?.availability}`,
    );

    console.log("\n  Completion needs evidence\n");

    const noPhotos = await artisan.db.rpc("advance_job_execution", {
      p_job_id: jobId,
      p_to: "awaiting_signoff",
    });
    check(
      "work cannot be marked done with no completion photo",
      noPhotos.error !== null,
      noPhotos.error ? `blocked: ${noPhotos.error.message.slice(0, 55)}` : "NOT BLOCKED",
    );

    await addCompletionPhoto(jobId, artisan.id);

    const done = await artisan.db.rpc("advance_job_execution", {
      p_job_id: jobId,
      p_to: "awaiting_signoff",
    });
    check(
      "with a photo, the job moves to awaiting_signoff",
      done.error === null && done.data === "awaiting_signoff",
      done.error?.message ?? `returned ${done.data}`,
    );

    console.log("\n  Sign-off\n");

    const artisanSigns = await artisan.db.rpc("sign_off_job", {
      p_job_id: jobId,
      p_signature: "Not the client",
      p_client_notes: null,
    });
    check(
      "an artisan cannot sign off their own work",
      artisanSigns.error !== null,
      artisanSigns.error ? `blocked: ${artisanSigns.error.message.slice(0, 40)}` : "NOT BLOCKED",
    );

    // A typed name, not a drawing. WCAG 2.2 requires a single-pointer
    // alternative to any drag operation, and both paths store the same field.
    const signed = await client.db.rpc("sign_off_job", {
      p_job_id: jobId,
      p_signature: "Ama Boateng",
      p_client_notes: "Tidy work, thank you.",
    });
    check(
      "client signs off, job moves to awaiting_balance",
      signed.error === null && signed.data === "awaiting_balance",
      signed.error?.message ?? `returned ${signed.data}`,
    );

    const { data: signoff } = await admin
      .from("signoffs")
      .select("signature_data, client_notes")
      .eq("job_id", jobId)
      .single();
    check(
      "the signature is stored",
      signoff?.signature_data === "Ama Boateng",
      `"${signoff?.signature_data}"`,
    );

    console.log("\n  The balance, on site\n");

    // total 358.40 + transport 20 = 378.40 agreed; 199.20 already banked.
    const balance = await client.db.rpc("balance_due_for_job", { p_job_id: jobId });
    check(
      "balance is everything agreed less everything banked",
      Number(balance.data) === 179.2,
      `GHS ${balance.data} (expected 179.20)`,
    );

    const balanceRef = await charge(jobId, "balance", Number(balance.data));
    await settle(balanceRef, Number(balance.data));

    check(
      "settling the balance completes the job",
      (await jobStatus(jobId)) === "paid",
      `status is ${await jobStatus(jobId)}`,
    );

    const { data: payout } = await admin
      .from("payouts")
      .select("amount, status")
      .eq("job_id", jobId)
      .maybeSingle();
    check(
      "a payout is queued for the artisan's quote plus transport",
      payout !== null && Number(payout.amount) === 340,
      payout ? `GHS ${payout.amount}, ${payout.status}` : "no payout row",
    );

    const { data: freed } = await admin
      .from("providers")
      .select("availability")
      .eq("profile_id", artisan.id)
      .single();
    check(
      "the artisan is released back into the pool",
      freed?.availability === "online",
      `availability is ${freed?.availability}`,
    );

    const closed = await client.db.rpc("close_job", { p_job_id: jobId });
    check(
      "a paid job can be closed",
      closed.error === null && closed.data === "closed",
      closed.error?.message ?? `returned ${closed.data}`,
    );

    // ---- the cancellation ladder ------------------------------------------
    console.log("\n  Cancellation tiers (PLAN.md §7)\n");

    const enRoute = await jobAtDepositPaid(client);
    created.push(enRoute.jobId);
    await enRoute.artisan.db.rpc("advance_job_execution", {
      p_job_id: enRoute.jobId,
      p_to: "en_route",
    });

    await client.db.rpc("cancel_job", {
      p_job_id: enRoute.jobId,
      p_reason: "Had to go out.",
    });

    const { data: enRouteEvent } = await admin
      .from("job_events")
      .select("metadata")
      .eq("job_id", enRoute.jobId)
      .eq("to_status", "cancelled_by_client")
      .single();
    check(
      "cancelling after the artisan sets out retains the transport fee",
      (enRouteEvent?.metadata as Record<string, unknown>)?.tier === "transport_retained" &&
        Number((enRouteEvent?.metadata as Record<string, number>)?.retained_ghs) === 20,
      JSON.stringify(enRouteEvent?.metadata),
    );

    const working = await jobAtDepositPaid(client);
    created.push(working.jobId);
    for (const to of ["en_route", "arrived", "in_progress"] as const) {
      await working.artisan.db.rpc("advance_job_execution", { p_job_id: working.jobId, p_to: to });
    }

    await client.db.rpc("cancel_job", { p_job_id: working.jobId, p_reason: "Changed my mind." });

    const { data: workingEvent } = await admin
      .from("job_events")
      .select("metadata")
      .eq("job_id", working.jobId)
      .eq("to_status", "cancelled_by_client")
      .single();
    check(
      "cancelling once work has started forfeits the deposit",
      (workingEvent?.metadata as Record<string, unknown>)?.tier === "deposit_forfeited",
      JSON.stringify(workingEvent?.metadata),
    );

    const { data: stillPaid } = await admin
      .from("payments")
      .select("status")
      .eq("job_id", working.jobId)
      .eq("leg", "deposit")
      .single();
    check(
      "a forfeited deposit is not refunded",
      stillPaid?.status === "succeeded",
      `deposit is ${stillPaid?.status}`,
    );
  } finally {
    await cleanup(created);
    console.log("\n  Test data removed.");
  }

  console.log(
    failures === 0 ? "\n  A job runs start to finish.\n" : `\n  ${failures} FAILED.\n`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

void main();
