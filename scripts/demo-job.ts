/**
 * Build one complete, paid job and leave it in the database.
 *
 * PLAN.md §12 ends every phase with "something demonstrable to the client".
 * The e2e suites prove the paths work and then delete everything they touched,
 * which is right for a test and useless for a demo — you cannot show a client
 * a job that no longer exists.
 *
 * This walks the same RPCs the e2e suites do, start to finish, and leaves the
 * job at `paid` with a signed-off invoice you can open and print.
 *
 * Needs the dev server up: the payment legs settle through the real signed
 * webhook, the same one Paystack will call.
 *
 *   npm run dev        # in another terminal
 *   npm run demo:job
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
const JOB_POINT = { lng: -0.1805, lat: 5.5561 };
const MOCK_WEBHOOK_SECRET = "artisangh-mock-webhook-secret";

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

async function settle(reference: string, amountGhs: number) {
  const body = JSON.stringify({
    event: "charge.success",
    data: {
      reference,
      amount: Math.round(amountGhs * 100),
      currency: "GHS",
      channel: "mobile_money",
      gateway_response: "Approved",
      paid_at: new Date().toISOString(),
    },
  });

  const response = await fetch(`${appUrl}/api/webhooks/payments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-paystack-signature": createHmac("sha512", MOCK_WEBHOOK_SECRET).update(body).digest("hex"),
    },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `webhook rejected the ${reference} settlement with ${response.status}. Is the dev server up?`,
    );
  }
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

async function main() {
  const client = await sessionFor(CLIENT_PHONE);

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
    p_address_text: "14 Oxford Street, Osu, Accra",
    p_ghanapost_code: "GA-183-4471",
    p_landmark: "Blue gate opposite the pharmacy",
  });
  await client.db
    .from("jobs")
    .update({ description: "Two kitchen sockets dead and the trip keeps going." })
    .eq("id", jobId);
  await client.db.rpc("post_job", { p_job_id: jobId });

  const { data: offer } = await admin
    .from("job_offers")
    .select("id, provider_id")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .limit(1)
    .single();
  if (!offer) throw new Error("no artisan was offered the job — is the seeded provider online?");

  const { data: holder } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", offer.provider_id)
    .single();

  const artisan = await sessionFor(holder!.phone);
  await artisan.db.rpc("respond_to_offer", { p_offer_id: offer.id, p_accept: true });

  // An itemised quote, because the invoice is only worth looking at with real
  // lines on it — labour and materials as separate kinds (PLAN.md §2).
  const quote = await artisan.db.rpc("save_quote", {
    p_job_id: jobId,
    p_items: [
      { kind: "labour", description: "Diagnose and replace two faulty sockets", quantity: 1, unit_price: 220 },
      { kind: "labour", description: "Trace and repair ring main fault", quantity: 1, unit_price: 100 },
      { kind: "material", description: "13A double socket", quantity: 2, unit_price: 45 },
      { kind: "material", description: "2.5mm twin and earth cable (metre)", quantity: 6, unit_price: 5 },
    ],
    p_notes: "Old sockets were cracked at the back box; replaced both.",
  });
  if (quote.error) throw new Error(`save_quote: ${quote.error.message}`);

  await artisan.db.rpc("send_quote", { p_quote_id: quote.data });
  await client.db.rpc("respond_to_quote", { p_quote_id: quote.data, p_accept: true, p_reason: null });

  const { data: q } = await admin
    .from("quotes")
    .select("deposit_amount")
    .eq("id", quote.data)
    .single();

  const depositDue = Number(q!.deposit_amount);
  await settle(await charge(jobId, "deposit", depositDue), depositDue);

  for (const status of ["en_route", "arrived", "in_progress"] as const) {
    const { error: advanceError } = await artisan.db.rpc("advance_job_execution", {
      p_job_id: jobId,
      p_to: status,
    });
    if (advanceError) throw new Error(`advance to ${status}: ${advanceError.message}`);
  }

  await admin.from("job_photos").insert({
    job_id: jobId,
    storage_path: `${jobId}/completion-${crypto.randomUUID()}.jpg`,
    stage: "completion",
    uploaded_by: artisan.id,
  });

  const done = await artisan.db.rpc("advance_job_execution", {
    p_job_id: jobId,
    p_to: "awaiting_signoff",
  });
  if (done.error) throw new Error(`mark complete: ${done.error.message}`);

  const signed = await client.db.rpc("sign_off_job", {
    p_job_id: jobId,
    p_signature: "Ama Boateng",
    p_client_notes: "Neat work, tidied up after. Sockets tested and working.",
  });
  if (signed.error) throw new Error(`sign off: ${signed.error.message}`);

  // Ask the database what is left rather than recomputing it here. `total`
  // excludes transport, so `total - deposit` silently under-charges by exactly
  // the transport fee — which is how this script shipped a GHS 20 short invoice
  // the first time it ran.
  const { data: outstanding, error: balanceError } = await client.db.rpc("balance_due_for_job", {
    p_job_id: jobId,
  });
  if (balanceError) throw new Error(`balance due: ${balanceError.message}`);
  const balanceDue = Number(outstanding);

  await settle(await charge(jobId, "balance", balanceDue), balanceDue);

  const { data: final } = await admin.from("jobs").select("status").eq("id", jobId).single();
  if (final?.status !== "paid") {
    throw new Error(`expected the job to land on paid, got "${final?.status}"`);
  }

  console.log(`\n  ${draft.reference} — ${final?.status}`);
  console.log(`  deposit GHS ${depositDue.toFixed(2)} · balance GHS ${balanceDue.toFixed(2)}`);
  console.log(`\n  Invoice:  ${appUrl}/client/jobs/${jobId}/invoice`);
  console.log(`  Job:      ${appUrl}/client/jobs/${jobId}\n`);
}

main().catch((error) => {
  console.error(`\n  ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
