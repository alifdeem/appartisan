/**
 * Phase 4 end-to-end: the deposit leg, including every way it fails.
 *
 * PLAN.md §13 rates "mock payments mask a real integration problem, surfacing
 * only at go-live" as the highest-severity risk in the build. The mitigation is
 * that the mock fires a **real signed webhook over real HTTP** into the same
 * handler Paystack will call — so this script exercises signature verification,
 * idempotency, the failure path and the retry path months before real money
 * touches any of it.
 *
 * Needs the dev server up, because the webhook is an actual HTTP round trip:
 *
 *   npm run dev            # in another terminal
 *   npm run e2e:payments
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

/** Mirrors MOCK_WEBHOOK_SECRET in src/lib/integrations/payments/mock.ts. */
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
    throw new Error(`Could not mint a session for ${phone}: ${error?.message}`);
  }

  const auth = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error: verifyError } = await auth.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError || !data.session) {
    throw new Error(`Could not verify a session for ${phone}: ${verifyError?.message}`);
  }

  return {
    id: data.user!.id,
    db: createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    }),
  };
}

async function jobStatus(jobId: string): Promise<string> {
  const { data } = await admin.from("jobs").select("status").eq("id", jobId).single();
  return data?.status ?? "??";
}

/**
 * Deliver a signed webhook exactly as the mock provider does.
 *
 * Rebuilt here rather than calling `MockPaymentProvider.settleCharge` so the
 * test can post a *deliberately wrong* signature, deliver the same event twice,
 * and control the payload — none of which the provider's own helper allows.
 */
async function deliverWebhook(
  body: string,
  { signature }: { signature?: string } = {},
): Promise<Response> {
  const signed = signature ?? createHmac("sha512", MOCK_WEBHOOK_SECRET).update(body).digest("hex");

  return fetch(`${appUrl}/api/webhooks/payments`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-paystack-signature": signed },
    body,
  });
}

function chargeEvent(reference: string, amountGhs: number, succeeded: boolean) {
  return JSON.stringify({
    event: succeeded ? "charge.success" : "charge.failed",
    data: {
      reference,
      amount: Math.round(amountGhs * 100),
      currency: "GHS",
      channel: "mobile_money",
      gateway_response: succeeded ? "Approved" : "Insufficient funds",
      paid_at: new Date().toISOString(),
      simulated: true,
    },
  });
}

/** A job driven to `awaiting_deposit`, which is where Phase 4 begins. */
async function jobAwaitingDeposit(client: { db: SupabaseClient; id: string }, artisanId: string) {
  const { data: category } = await admin
    .from("categories")
    .select("id")
    .eq("slug", "electrical")
    .single();

  const { data: draft, error: draftError } = await client.db
    .from("jobs")
    .insert({ client_id: client.id, category_id: category!.id })
    .select("id, reference")
    .single();

  if (draftError || !draft) throw new Error(`draft insert: ${draftError?.message}`);
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

  const posted = await client.db.rpc("post_job", { p_job_id: jobId });
  if (posted.error) throw new Error(`post_job: ${posted.error.message}`);

  // Whoever the matcher picked. Two approved artisans sit in Osu for these
  // scripts, so the offer does not reliably go to the one this file created —
  // it goes to the nearest, and the test has to answer as whoever that is.
  const { data: offers, error: offerError } = await admin
    .from("job_offers")
    // No profile embed: `job_offers.provider_id` references `providers`, not
    // `profiles`, so that hint does not exist. The phone is looked up below.
    .select("id, provider_id")
    .eq("job_id", jobId)
    .eq("status", "pending");

  if (offerError) throw new Error(`reading offers: ${offerError.message}`);
  if (!offers || offers.length === 0) {
    throw new Error(`no offer created — job is ${await jobStatus(jobId)}`);
  }

  const offer = offers[0] as unknown as { id: string; provider_id: string };
  const holderPhone = await phoneFor(offer.provider_id);
  const artisan = await sessionFor(holderPhone);

  const accepted = await artisan.db.rpc("respond_to_offer", {
    p_offer_id: offer.id,
    p_accept: true,
  });
  if (accepted.error) throw new Error(`respond_to_offer: ${accepted.error.message}`);

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

  void artisanId;
  return { jobId, reference: draft.reference as string, artisan };
}

/** The phone behind a profile id, so a session can be minted for whoever won the offer. */
async function phoneFor(profileId: string): Promise<string> {
  const { data } = await admin.from("profiles").select("phone").eq("id", profileId).single();
  if (!data) throw new Error(`no profile for ${profileId}`);
  return data.phone;
}

async function main() {
  const created: string[] = [];

  try {
    // A dedicated artisan, so this script never fights e2e-matching over the
    // seeded one's availability.
    const artisan = await ensureArtisan();
    const client = await sessionFor(CLIENT_PHONE);

    console.log("\n  Setting up a job at awaiting_deposit\n");

    const { jobId, artisan: holder } = await jobAwaitingDeposit(client, artisan.id);
    created.push(jobId);

    check(
      "job reaches awaiting_deposit",
      (await jobStatus(jobId)) === "awaiting_deposit",
      `status is ${await jobStatus(jobId)}`,
    );

    // 320 subtotal + 12% = 358.40, half = 179.20, + 20 transport = 199.20
    const due = await client.db.rpc("deposit_due_for_job", { p_job_id: jobId });
    check(
      "deposit due comes from the accepted quote",
      Number(due.data) === 199.2,
      `GHS ${due.data} (expected 199.20)`,
    );

    console.log("\n  Authority\n");

    const artisanAsksDue = await holder.db.rpc("deposit_due_for_job", { p_job_id: jobId });
    check(
      "the assigned artisan may see what is owed",
      artisanAsksDue.error === null,
      artisanAsksDue.error?.message ?? `GHS ${artisanAsksDue.data}`,
    );

    const selfSettle = await client.db.rpc("settle_payment", {
      p_reference: "anything",
      p_succeeded: true,
      p_reason: null,
      p_channel: null,
    });
    check(
      "a client cannot mark their own payment paid",
      selfSettle.error !== null,
      selfSettle.error ? `blocked: ${selfSettle.error.message.slice(0, 60)}` : "NOT BLOCKED",
    );

    console.log("\n  A declined prompt\n");

    const first = await startCharge(jobId, 199.2, "mtn");
    check("charge initialises as pending", first.status === "pending", `status ${first.status}`);

    const declined = await deliverWebhook(chargeEvent(first.reference, 199.2, false));
    check("webhook accepted the failure event", declined.ok, `HTTP ${declined.status}`);

    const afterFail = await paymentByRef(first.reference);
    check(
      "a declined charge is recorded with the gateway's reason",
      afterFail?.status === "failed" && afterFail.failure_reason === "Insufficient funds",
      `${afterFail?.status} — ${afterFail?.failure_reason}`,
    );
    check(
      "the job stays payable so the client can retry",
      (await jobStatus(jobId)) === "awaiting_deposit",
      `status is ${await jobStatus(jobId)}`,
    );

    console.log("\n  The retry that migration 0012 unblocked\n");

    // Under the original `unique (job_id, leg)` this insert was impossible, and
    // a single declined prompt bricked the job permanently.
    const second = await startCharge(jobId, 199.2, "mtn");
    check(
      "a second attempt can be created on the same leg",
      second.reference !== first.reference,
      `new reference ${second.reference}`,
    );

    const ok = await deliverWebhook(chargeEvent(second.reference, 199.2, true));
    check("webhook accepted the success event", ok.ok, `HTTP ${ok.status}`);

    check(
      "the job advances to deposit_paid",
      (await jobStatus(jobId)) === "deposit_paid",
      `status is ${await jobStatus(jobId)}`,
    );

    const settled = await paymentByRef(second.reference);
    check(
      "the successful payment is stamped with a paid_at",
      settled?.status === "succeeded" && settled.paid_at !== null,
      `${settled?.status}, paid_at ${settled?.paid_at ? "set" : "null"}`,
    );

    console.log("\n  Duplicate and hostile delivery\n");

    // Providers retry. A second delivery of a success already banked must be a
    // no-op, not a second credit.
    const replay = await deliverWebhook(chargeEvent(second.reference, 199.2, true));
    const { count: successCount } = await admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "succeeded");
    check(
      "replaying a success is idempotent",
      replay.ok && successCount === 1,
      `HTTP ${replay.status}, ${successCount} succeeded row(s)`,
    );

    const forged = await deliverWebhook(chargeEvent(second.reference, 199.2, false), {
      signature: "0".repeat(128),
    });
    check(
      "a wrongly-signed webhook is rejected",
      forged.status === 401,
      `HTTP ${forged.status}`,
    );
    check(
      "the forged event changed nothing",
      (await jobStatus(jobId)) === "deposit_paid",
      `status is ${await jobStatus(jobId)}`,
    );

    const unknown = await deliverWebhook(chargeEvent("mock_chg_doesnotexist", 10, true));
    check(
      "an event for an unknown reference is absorbed, not retried",
      unknown.ok,
      `HTTP ${unknown.status} — a 500 here makes the provider retry for days`,
    );

    console.log("\n  Cancelling after paying (PLAN.md §7)\n");

    const cancelled = await client.db.rpc("cancel_job", {
      p_job_id: jobId,
      p_reason: "Changed my mind before anyone travelled.",
    });
    check(
      "a client may cancel once the deposit is paid",
      cancelled.error === null && (await jobStatus(jobId)) === "cancelled_by_client",
      cancelled.error?.message ?? `status is ${await jobStatus(jobId)}`,
    );

    const refunded = await paymentByRef(second.reference);
    check(
      "the deposit is refunded in full",
      refunded?.status === "refunded",
      `payment is ${refunded?.status}`,
    );
  } finally {
    for (const jobId of created) {
      // `payments.job_id` is ON DELETE RESTRICT — money rows outlive jobs on
      // purpose, so they have to go first.
      await admin.from("payments").delete().eq("job_id", jobId);
      await admin.from("jobs").delete().eq("id", jobId);
    }
    console.log("\n  Test data removed.");
  }

  console.log(
    failures === 0 ? "\n  The deposit leg works end to end.\n" : `\n  ${failures} FAILED.\n`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

/** A second approved artisan in Osu, so this script owns its own supply. */
async function ensureArtisan() {
  const email = syntheticEmail(ARTISAN_PHONE);
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list.users.find((candidate) => candidate.email === email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID(),
      user_metadata: { phone: ARTISAN_PHONE, full_name: "Payments Test Artisan", role: "provider" },
    });
    if (error || !data.user) throw new Error(`Could not create artisan: ${error?.message}`);
    user = data.user;
  }

  await admin
    .from("providers")
    .update({
      verification_status: "approved",
      availability: "online",
      bio: "Test artisan used by the payments end-to-end script. Electrical work in Osu.",
      years_experience: 5,
      base_city: "Accra",
      momo_number: ARTISAN_PHONE,
      momo_network: "mtn",
    })
    .eq("profile_id", user.id);

  await admin.rpc("set_provider_location", {
    p_provider_id: user.id,
    p_lng: -0.1826,
    p_lat: 5.5573,
  });

  const { data: category } = await admin
    .from("categories")
    .select("id")
    .eq("slug", "electrical")
    .single();
  await admin
    .from("provider_categories")
    .upsert(
      { provider_id: user.id, category_id: category!.id },
      { onConflict: "provider_id,category_id" },
    );

  return sessionFor(ARTISAN_PHONE);
}

async function startCharge(jobId: string, amountGhs: number, network: string) {
  const reference = `mock_chg_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  const { error } = await admin.from("payments").insert({
    job_id: jobId,
    leg: "deposit",
    amount: amountGhs,
    status: "pending",
    channel: "momo",
    momo_network: network,
    provider_reference: reference,
    is_simulated: true,
  });

  if (error) throw new Error(`Could not start a charge: ${error.message}`);

  return { reference, status: "pending" as const };
}

async function paymentByRef(reference: string) {
  const { data } = await admin
    .from("payments")
    .select("status, failure_reason, paid_at")
    .eq("provider_reference", reference)
    .maybeSingle();
  return data;
}

void main();
