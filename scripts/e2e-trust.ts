/**
 * Phase 6 end-to-end: ratings, disputes, reliability scoring.
 *
 * The interesting assertions here are the negative ones. Migration 0018
 * replaced an RLS policy that let any client insert a rating for any provider
 * on any job — reputation is the product's whole promise, so a forgeable
 * ratings table is the most valuable hole in the schema. That path is tested
 * directly below rather than assumed closed.
 *
 * Needs the dev server up: the job is driven through payment first, and the
 * balance leg settles through the real signed webhook.
 *
 *   npm run dev        # in another terminal
 *   npm run e2e:trust
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
const ADMIN_PHONE = "+233243333333";
const JOB_POINT = { lng: -0.1805, lat: 5.5561 };
const MOCK_WEBHOOK_SECRET = "artisangh-mock-webhook-secret";

const syntheticEmail = (e164: string) => `${e164.replace("+", "")}@phone.artisangh.app`;

let failures = 0;

function check(name: string, pass: boolean, detail: string) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!pass) failures += 1;
}

async function sessionFor(phone: string): Promise<{ db: SupabaseClient; id: string }> {
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: syntheticEmail(phone),
  });
  if (error || !link?.properties?.hashed_token) throw new Error(`session ${phone}: ${error?.message}`);

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
  if (!response.ok) throw new Error(`webhook ${response.status} — is the dev server up?`);
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

/** Drives one job from draft all the way to `paid`. */
async function paidJob(client: { db: SupabaseClient; id: string }) {
  const { data: category } = await admin
    .from("categories")
    .select("id")
    .eq("slug", "electrical")
    .single();

  const { data: draft } = await client.db
    .from("jobs")
    .insert({ client_id: client.id, category_id: category!.id })
    .select("id")
    .single();
  const jobId = draft!.id as string;

  await client.db.rpc("set_job_location", {
    p_job_id: jobId,
    p_lng: JOB_POINT.lng,
    p_lat: JOB_POINT.lat,
    p_address_text: "Osu, Accra",
    p_ghanapost_code: null,
    p_landmark: "Blue gate opposite the pharmacy",
  });
  await client.db.from("jobs").update({ description: "Sockets dead." }).eq("id", jobId);
  await client.db.rpc("post_job", { p_job_id: jobId });

  const { data: offer } = await admin
    .from("job_offers")
    .select("id, provider_id")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .limit(1)
    .single();

  const { data: holder } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", offer!.provider_id)
    .single();

  const artisan = await sessionFor(holder!.phone);
  await artisan.db.rpc("respond_to_offer", { p_offer_id: offer!.id, p_accept: true });

  const quote = await artisan.db.rpc("save_quote", {
    p_job_id: jobId,
    p_items: [{ kind: "labour", description: "Replace sockets", quantity: 1, unit_price: 320 }],
    p_notes: null,
  });
  await artisan.db.rpc("send_quote", { p_quote_id: quote.data });
  await client.db.rpc("respond_to_quote", { p_quote_id: quote.data, p_accept: true, p_reason: null });

  const { data: q } = await admin
    .from("quotes")
    .select("deposit_amount")
    .eq("id", quote.data)
    .single();
  await settle(await charge(jobId, "deposit", Number(q!.deposit_amount)), Number(q!.deposit_amount));

  for (const to of ["en_route", "arrived", "in_progress"] as const) {
    await artisan.db.rpc("advance_job_execution", { p_job_id: jobId, p_to: to });
  }
  await admin.from("job_photos").insert({
    job_id: jobId,
    storage_path: `${jobId}/completion-${crypto.randomUUID()}.jpg`,
    stage: "completion",
    uploaded_by: artisan.id,
  });
  await artisan.db.rpc("advance_job_execution", { p_job_id: jobId, p_to: "awaiting_signoff" });
  await client.db.rpc("sign_off_job", {
    p_job_id: jobId,
    p_signature: "Ama Boateng",
    p_client_notes: null,
  });

  const { data: due } = await client.db.rpc("balance_due_for_job", { p_job_id: jobId });
  await settle(await charge(jobId, "balance", Number(due)), Number(due));

  return { jobId, artisanId: artisan.id, artisan };
}

async function cleanup(jobIds: string[]) {
  for (const jobId of jobIds) {
    await admin.from("ratings").delete().eq("job_id", jobId);
    await admin.from("disputes").delete().eq("job_id", jobId);
    await admin.from("payouts").delete().eq("job_id", jobId);
    await admin.from("payments").delete().eq("job_id", jobId);
    await admin.from("jobs").delete().eq("id", jobId);
  }
  await admin.from("providers").update({ availability: "online" }).eq("availability", "on_job");
}

async function main() {
  const created: string[] = [];

  try {
    const client = await sessionFor(CLIENT_PHONE);

    console.log("\n  Rating a finished job\n");

    const { jobId, artisanId } = await paidJob(client);
    created.push(jobId);

    const { data: before } = await admin
      .from("providers")
      .select("rating_avg, rating_count, jobs_completed")
      .eq("profile_id", artisanId)
      .single();

    check(
      "a completed job counts towards jobs_completed",
      Number(before!.jobs_completed) > 0,
      `jobs_completed is ${before!.jobs_completed}`,
    );

    const rated = await client.db.rpc("rate_job", {
      p_job_id: jobId,
      p_stars: 5,
      p_comment: "Fast and tidy.",
      p_tags: ["punctual", "tidy"],
    });
    check("the client can rate the artisan", rated.error === null, rated.error?.message ?? "accepted");

    const { data: after } = await admin
      .from("providers")
      .select("rating_avg, rating_count")
      .eq("profile_id", artisanId)
      .single();
    // Assert the counter matches the table rather than merely that it moved.
    // "It went up" passes on a stale counter left behind by a previous run,
    // which is exactly how the drift 0019 fixes stayed invisible.
    const { count: actualRatings } = await admin
      .from("ratings")
      .select("job_id", { count: "exact", head: true })
      .eq("provider_id", artisanId);
    check(
      "the rating lands on the artisan's profile",
      Number(after!.rating_count) === actualRatings,
      `profile says ${after!.rating_count}, table holds ${actualRatings}, avg ${after!.rating_avg}`,
    );

    const revised = await client.db.rpc("rate_job", {
      p_job_id: jobId,
      p_stars: 4,
      p_comment: "Changed my mind.",
      p_tags: [],
    });
    const { data: afterRevision } = await admin
      .from("providers")
      .select("rating_count")
      .eq("profile_id", artisanId)
      .single();
    check(
      "re-rating revises rather than double-counting",
      revised.error === null && afterRevision!.rating_count === after!.rating_count,
      revised.error?.message ?? `still ${afterRevision!.rating_count} rating(s)`,
    );

    console.log("\n  Ratings cannot be forged\n");

    // The hole 0018 closed: the 0003 policy checked only `client_id = auth.uid()`,
    // so a client could name ANY provider on ANY job.
    //
    // The real rating has to come out of the way first. `ratings.job_id` is the
    // primary key, so with it in place the insert below fails with 23505 before
    // RLS is ever consulted — which is a unique violation dressed up as a
    // security assertion. Asserting on the error CODE rather than merely on
    // "it failed" is what keeps this honest.
    await admin.from("ratings").delete().eq("job_id", jobId);

    const { data: otherProvider } = await admin
      .from("providers")
      .select("profile_id")
      .neq("profile_id", artisanId)
      .limit(1)
      .maybeSingle();

    if (otherProvider) {
      const forged = await client.db.from("ratings").insert({
        job_id: jobId,
        client_id: client.id,
        provider_id: otherProvider.profile_id, // an artisan who never saw this job
        stars: 1,
        comment: "Forged onto an artisan who was never here.",
      });
      check(
        "a client cannot rate an artisan who was not on the job",
        forged.error !== null && forged.error.code !== "23505",
        forged.error
          ? `blocked: ${forged.error.code}`
          : "NOT BLOCKED — reputation is forgeable",
      );
    } else {
      console.log("  SKIP  forged rating — only one provider exists to test against");
    }

    // Restore it, so the reliability figures below describe the real history.
    await client.db.rpc("rate_job", { p_job_id: jobId, p_stars: 4, p_comment: null, p_tags: [] });

    const unpaid = await admin
      .from("jobs")
      .select("id")
      .eq("client_id", client.id)
      .not("status", "in", "(paid,closed)")
      .limit(1)
      .maybeSingle();

    if (unpaid.data) {
      const early = await client.db.rpc("rate_job", { p_job_id: unpaid.data.id, p_stars: 5 });
      check(
        "a job cannot be rated before it is paid for",
        early.error !== null,
        early.error ? `blocked: ${early.error.message.slice(0, 50)}` : "NOT BLOCKED",
      );
    }

    console.log("\n  Disputes\n");

    const dispute = await client.db.rpc("raise_dispute", {
      p_job_id: jobId,
      p_reason: "Socket stopped working the next day",
      p_detail: "The left one is dead again.",
      p_evidence_paths: [`${jobId}/evidence-1.jpg`],
    });
    check("a participant can raise a dispute", dispute.error === null, dispute.error?.message ?? "raised");

    const duplicate = await client.db.rpc("raise_dispute", {
      p_job_id: jobId,
      p_reason: "Again",
    });
    check(
      "a second open dispute on the same job is refused",
      duplicate.error !== null,
      duplicate.error ? `blocked: ${duplicate.error.code}` : "NOT BLOCKED",
    );

    const clientResolves = await client.db.rpc("resolve_dispute", {
      p_dispute_id: dispute.data,
      p_status: "resolved",
      p_resolution: "I say it is fine.",
    });
    check(
      "a client cannot resolve their own dispute",
      clientResolves.error !== null,
      clientResolves.error ? `blocked: ${clientResolves.error.code}` : "NOT BLOCKED",
    );

    const adminUser = await sessionFor(ADMIN_PHONE);
    const blank = await adminUser.db.rpc("resolve_dispute", {
      p_dispute_id: dispute.data,
      p_status: "resolved",
      p_resolution: "   ",
    });
    check(
      "resolving requires a written decision",
      blank.error !== null,
      blank.error ? `blocked: ${blank.error.message.slice(0, 45)}` : "NOT BLOCKED",
    );

    const resolved = await adminUser.db.rpc("resolve_dispute", {
      p_dispute_id: dispute.data,
      p_status: "resolved",
      p_resolution: "Artisan returned and replaced the faceplate at no charge.",
    });
    check("an admin resolves it", resolved.error === null, resolved.error?.message ?? `→ ${resolved.data}`);

    console.log("\n  Reliability (PLAN.md §8)\n");

    const stats = await adminUser.db.rpc("provider_reliability", { p_provider_id: artisanId });
    check(
      "reliability reports the rolling window",
      stats.error === null && stats.data?.window_days === 30,
      stats.error?.message ?? `${stats.data?.offers} offer(s), accept rate ${stats.data?.accept_rate}%`,
    );

    const stranger = await client.db.rpc("provider_reliability", { p_provider_id: artisanId });
    check(
      "a client cannot read an artisan's reliability record",
      stranger.error !== null,
      stranger.error ? `blocked: ${stranger.error.code}` : "NOT BLOCKED",
    );

    const verdict = await adminUser.db.rpc("reliability_verdict", { p_provider_id: artisanId });
    check(
      "a verdict is returned with its reasons",
      verdict.error === null && typeof verdict.data?.action === "string",
      verdict.error?.message ?? `action "${verdict.data?.action}"`,
    );

    const sweepAsUser = await adminUser.db.rpc("apply_reliability_scoring");
    check(
      "the sweep is not reachable with a user's session",
      sweepAsUser.error !== null,
      sweepAsUser.error ? `blocked: ${sweepAsUser.error.code}` : "NOT BLOCKED",
    );

    const sweep = await admin.rpc("apply_reliability_scoring");
    check(
      "the platform can run the sweep",
      sweep.error === null,
      sweep.error?.message ?? `suspended ${sweep.data ?? 0} artisan(s)`,
    );

    console.log("\n  Admin configuration\n");

    const clientSetting = await client.db.rpc("update_setting", {
      p_key: "platform_commission_pct",
      p_value: 1,
    });
    check(
      "a client cannot change the commission",
      clientSetting.error !== null,
      clientSetting.error ? `blocked: ${clientSetting.error.code}` : "NOT BLOCKED",
    );

    const silly = await adminUser.db.rpc("update_setting", {
      p_key: "platform_commission_pct",
      p_value: 95,
    });
    check(
      "an absurd commission is refused",
      silly.error !== null,
      silly.error ? `blocked: ${silly.error.message.slice(0, 45)}` : "NOT BLOCKED",
    );

    const ok = await adminUser.db.rpc("update_setting", {
      p_key: "platform_commission_pct",
      p_value: 12,
    });
    check("an admin can set it", ok.error === null, ok.error?.message ?? "commission still 12");
  } finally {
    await cleanup(created);
    console.log("\n  Test data removed.");
  }

  console.log(
    failures === 0 ? "\n  Trust and admin work end to end.\n" : `\n  ${failures} CHECK(S) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\n  ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
