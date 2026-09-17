/**
 * Phase 3 end-to-end: post → match → offer → accept → quote → accept.
 *
 * This is the demo path from PLAN.md §12 exercised as SQL, with real sessions
 * for the client and the artisan rather than the service role — so RLS, the
 * column guards and the status machine are all in the loop.
 *
 * It creates a job and drives it to `awaiting_deposit`, which is past the point
 * a client may delete one, so it cleans up with the service role at the end.
 * Run it against a seeded database: `npx tsx scripts/e2e-matching.ts`.
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CLIENT_PHONE = "+233241111111";
const ARTISAN_PHONE = "+233242222222";

/** Osu, a few hundred metres from where the seed pins the artisan. */
const JOB_POINT = { lng: -0.1805, lat: 5.5561 };

let failures = 0;
function check(name: string, pass: boolean, detail: string) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!pass) failures++;
}

const syntheticEmail = (e164: string) => `${e164.replace("+", "")}@phone.artisangh.app`;

/** A session-bound client for a seeded account, minted the way the app does. */
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

/** The phone behind a profile id, so a session can be minted for whoever won an offer. */
async function phoneFor(profileId: string): Promise<string> {
  const { data } = await admin.from("profiles").select("phone").eq("id", profileId).single();
  if (!data) throw new Error(`no profile for ${profileId}`);
  return data.phone;
}

async function jobStatus(jobId: string): Promise<string> {
  const { data } = await admin.from("jobs").select("status").eq("id", jobId).single();
  return data?.status ?? "??";
}

/**
 * The two unhappy paths, which PLAN.md §6 says will be the common ones.
 *
 * With no price guidance in v1, artisans price freely and clients decline — so
 * "declined" is a first-class transition, not an error case.
 *
 * Neither assertion pins itself to a particular artisan or to the list being
 * exhausted. Supply changes: other scripts create approved artisans, and real
 * signups will too. What must hold regardless is that a decline moves the job
 * on and that the artisan who declined never sees it again.
 */
async function runDeclinePaths() {
  const client = await sessionFor(CLIENT_PHONE);
  let scratch: string | null = null;

  try {
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

    scratch = draft!.id;
    const job = draft!.id;

    await client.db.rpc("set_job_location", {
      p_job_id: job,
      p_lng: JOB_POINT.lng,
      p_lat: JOB_POINT.lat,
      p_address_text: "Osu, Accra",
      p_ghanapost_code: null,
      p_landmark: "Blue gate opposite the pharmacy",
    });
    await client.db.from("jobs").update({ description: "Socket sparking." }).eq("id", job);
    await client.db.rpc("post_job", { p_job_id: job });

    console.log("\n  Declining an offer\n");

    const { data: offer } = await admin
      .from("job_offers")
      .select("id, provider_id")
      .eq("job_id", job)
      .maybeSingle();

    check(
      "a free artisan gets offered the second job",
      offer !== null,
      offer ? "offer created" : "NO OFFER — is the artisan still busy on another job?",
    );
    if (!offer) return;

    const holder = await sessionFor(await phoneFor(offer.provider_id));
    const declined = await holder.db.rpc("respond_to_offer", {
      p_offer_id: offer.id,
      p_accept: false,
    });
    // Either outcome is correct and which one you get depends on supply: with
    // another artisan in range the job moves straight to them, and only an
    // exhausted candidate list falls through to the admin queue. Asserting on
    // `unmatched` alone would make this test fail whenever supply improves.
    check(
      "declining passes the job on rather than cancelling it",
      declined.error === null &&
        ["offer_sent", "matching", "unmatched"].includes(String(declined.data)),
      declined.error?.message ?? `returned ${declined.data}`,
    );

    const { data: offerAfter } = await admin
      .from("job_offers")
      .select("status")
      .eq("id", offer.id)
      .single();
    check(
      "the declined offer is recorded, not deleted",
      offerAfter?.status === "declined",
      `status is ${offerAfter?.status}`,
    );

    // The invariant that actually matters, and the one that makes the
    // decline-and-rematch loop terminate instead of spinning forever:
    // `find_candidate_providers` excludes anyone already offered this job, so
    // the artisan who just declined must never appear on it twice.
    const { data: allOffers } = await admin
      .from("job_offers")
      .select("provider_id")
      .eq("job_id", job);

    const timesOffered = (allOffers ?? []).filter(
      (row) => row.provider_id === holder.id,
    ).length;

    check(
      "a declined artisan is never re-offered the same job",
      timesOffered === 1,
      `offered to them ${timesOffered}×, ${allOffers?.length} offer(s) on the job in total`,
    );

    console.log("\n  Admin rescue, then a rejected price\n");

    const adminSession = await sessionFor("+233243333333");
    const assigned = await adminSession.db.rpc("admin_assign_job", {
      p_job_id: job,
      p_provider_id: holder.id,
    });
    check(
      "admin can assign a stalled job by hand",
      assigned.error === null && (await jobStatus(job)) === "quote_pending",
      assigned.error?.message ?? `status is ${await jobStatus(job)}`,
    );

    const quoteId = await holder.db.rpc("save_quote", {
      p_job_id: job,
      p_items: [{ kind: "labour", description: "Rewire socket", quantity: 1, unit_price: 900 }],
      p_notes: null,
    });
    await holder.db.rpc("send_quote", { p_quote_id: quoteId.data });

    const rejected = await client.db.rpc("respond_to_quote", {
      p_quote_id: quoteId.data,
      p_accept: false,
      p_reason: "Far too expensive.",
    });
    check(
      "a rejected quote sends the job back out, not to cancelled",
      rejected.error === null && ["matching", "offer_sent", "unmatched"].includes(rejected.data!),
      rejected.error?.message ?? `returned ${rejected.data}`,
    );

    const { data: afterReject } = await admin
      .from("jobs")
      .select("quote_rejections, provider_id")
      .eq("id", job)
      .single();
    check(
      "the rejection is counted and the artisan released",
      afterReject?.quote_rejections === 1 && afterReject?.provider_id === null,
      `rejections ${afterReject?.quote_rejections}, provider ${afterReject?.provider_id ?? "none"}`,
    );
  } finally {
    if (scratch) await admin.from("jobs").delete().eq("id", scratch);
  }
}

async function main() {
  let jobId: string | null = null;

  try {
    const client = await sessionFor(CLIENT_PHONE);
    const artisan = await sessionFor(ARTISAN_PHONE);

    // The artisan must be online and approved for the matcher to see them. The
    // seed does this, but a previous run of verify.ts may have left them off.
    await admin
      .from("providers")
      .update({ verification_status: "approved", availability: "online" })
      .eq("profile_id", artisan.id);

    const { data: category } = await admin
      .from("categories")
      .select("id, name")
      .eq("slug", "electrical")
      .single();

    console.log("\n  Posting\n");

    const { data: draft, error: draftError } = await client.db
      .from("jobs")
      .insert({ client_id: client.id, category_id: category!.id })
      .select("id, reference")
      .single();

    check("client creates a draft", !draftError && Boolean(draft), draftError?.message ?? draft!.reference);
    if (!draft) return;

    jobId = draft.id;
    // A non-null local alongside the nullable `jobId`, which exists only so the
    // finally-block can clean up. Narrowing does not survive the awaits below.
    const job = draft.id;

    await client.db.rpc("set_job_location", {
      p_job_id: job,
      p_lng: JOB_POINT.lng,
      p_lat: JOB_POINT.lat,
      p_address_text: "Osu, Accra",
      p_ghanapost_code: null,
      p_landmark: "Blue gate opposite the pharmacy",
    });
    await client.db
      .from("jobs")
      .update({ description: "Two sockets in the kitchen have stopped working entirely." })
      .eq("id", job);

    const posted = await client.db.rpc("post_job", { p_job_id: job });
    check("post_job succeeds", posted.error === null, posted.error?.message ?? "posted");

    // post_job hands straight to the matcher, so this should already be an offer.
    check(
      "matcher fired an offer in the same transaction",
      (await jobStatus(job)) === "offer_sent",
      `status is ${await jobStatus(job)}`,
    );

    const { data: offer } = await admin
      .from("job_offers")
      .select("id, provider_id, sequence_no, distance_km, status, expires_at")
      .eq("job_id", job)
      .single();

    // Asserted on the offer's SHAPE, not on which artisan won it. Other scripts
    // and real signups add approved artisans in Osu, and pinning this to the
    // seeded one makes the test fail for the healthiest possible reason —
    // somebody nearer was available.
    check(
      "offer went to an approved online artisan, nearest first",
      offer?.status === "pending" && Number(offer?.distance_km) < 5,
      offer ? `seq ${offer.sequence_no}, ${offer.distance_km}km, expires ${offer.expires_at}` : "no offer",
    );

    // Everything after this answers as whoever is actually holding it.
    const holder = await sessionFor(await phoneFor(offer!.provider_id));

    console.log("\n  Guards\n");

    const widen = await client.db
      .from("jobs")
      .update({ matching_radius_km: 100, quote_rejections: 0 })
      .eq("id", job);
    check(
      "client cannot widen their own search radius",
      widen.error !== null,
      widen.error ? `blocked: ${widen.error.code}` : "NOT BLOCKED",
    );

    // Asserted on stored state, not on `.error`. RLS filtering an UPDATE to
    // zero rows is a silent success at the API boundary — here the "jobs:
    // assigned provider updates" policy is scoped `using (provider_id =
    // auth.uid())`, and provider_id is still null, so the row is simply not
    // visible to this artisan and nothing happens. Checking the error would
    // report a hole that isn't there; checking the row is what proves it.
    const steal = await holder.db
      .from("jobs")
      .update({ provider_id: holder.id })
      .eq("id", job);
    const afterSteal = await admin
      .from("jobs")
      .select("provider_id")
      .eq("id", job)
      .single();
    check(
      "artisan cannot assign the job to themselves directly",
      afterSteal.data?.provider_id === null,
      steal.error
        ? `blocked: ${steal.error.code}`
        : afterSteal.data?.provider_id === null
          ? "filtered to zero rows by RLS, job still unassigned"
          : `NOT BLOCKED — provider_id is ${afterSteal.data?.provider_id}`,
    );

    const clientAccepts = await client.db.rpc("respond_to_offer", {
      p_offer_id: offer!.id,
      p_accept: true,
    });
    check(
      "a client cannot answer an artisan's offer",
      clientAccepts.error !== null,
      clientAccepts.error ? `blocked: ${clientAccepts.error.message}` : "NOT BLOCKED",
    );

    console.log("\n  Accepting\n");

    const accept = await holder.db.rpc("respond_to_offer", {
      p_offer_id: offer!.id,
      p_accept: true,
    });
    check(
      "artisan accepts, job moves to quote_pending",
      accept.error === null && accept.data === "quote_pending",
      accept.error?.message ?? `returned ${accept.data}`,
    );

    console.log("\n  Quoting\n");

    // Totals must be derived from these lines, not supplied.
    const items = [
      { kind: "labour", description: "Trace fault and replace two socket outlets", quantity: 1, unit_price: 180 },
      { kind: "material", description: "Double socket outlets", quantity: 2, unit_price: 45 },
      { kind: "material", description: "2.5mm twin and earth cable", quantity: 4, unit_price: 12.5 },
    ];
    const expectedSubtotal = 180 + 2 * 45 + 4 * 12.5; // 320

    const saved = await holder.db.rpc("save_quote", {
      p_job_id: job,
      p_items: items,
      p_notes: "Price includes testing the whole kitchen ring.",
    });
    check("artisan saves a draft quote", saved.error === null, saved.error?.message ?? String(saved.data));
    if (saved.error) return;

    const { data: quote } = await admin
      .from("quotes")
      .select("id, status, subtotal, service_fee_pct, service_fee_amount, transport_fee, total, deposit_amount")
      .eq("id", saved.data)
      .single();

    check(
      "subtotal is derived from the line items",
      Number(quote!.subtotal) === expectedSubtotal,
      `${quote!.subtotal} (expected ${expectedSubtotal})`,
    );

    const expectedFee = Math.round(expectedSubtotal * 0.12 * 100) / 100;
    const expectedTotal = expectedSubtotal + expectedFee;
    check(
      "12% service fee and total computed server-side",
      Number(quote!.service_fee_amount) === expectedFee && Number(quote!.total) === expectedTotal,
      `fee ${quote!.service_fee_amount}, total ${quote!.total}`,
    );

    // Artisan is ~0.2km away, so band 1 (0–5km) at GHS 20.
    check(
      "transport picked up from the distance band",
      Number(quote!.transport_fee) === 20,
      `GHS ${quote!.transport_fee}`,
    );

    const expectedDeposit =
      Math.round(expectedTotal * 0.5 * 100) / 100 + Number(quote!.transport_fee);
    check(
      "deposit is half the marked-up total plus all transport",
      Number(quote!.deposit_amount) === expectedDeposit,
      `${quote!.deposit_amount} (expected ${expectedDeposit})`,
    );

    const { data: savedItems } = await admin
      .from("quote_items")
      .select("kind, amount")
      .eq("quote_id", quote!.id)
      .order("sort_order");
    check(
      "line items stored with computed amounts",
      savedItems?.length === 3 && Number(savedItems[1].amount) === 90,
      `${savedItems?.length} lines`,
    );

    const forged = await client.db
      .from("quotes")
      .update({ total: 1, subtotal: 1 })
      .eq("id", quote!.id);
    const afterForge = await admin.from("quotes").select("total").eq("id", quote!.id).single();
    check(
      "client cannot rewrite the quote total",
      Number(afterForge.data!.total) === expectedTotal,
      forged.error ? `blocked: ${forged.error.code}` : `total still ${afterForge.data!.total}`,
    );

    const sent = await holder.db.rpc("send_quote", { p_quote_id: quote!.id });
    check(
      "artisan sends the quote",
      sent.error === null && (await jobStatus(job)) === "quote_sent",
      sent.error?.message ?? `status is ${await jobStatus(job)}`,
    );

    console.log("\n  The client's answer\n");

    const artisanSelfAccept = await holder.db.rpc("respond_to_quote", {
      p_quote_id: quote!.id,
      p_accept: true,
      p_reason: null,
    });
    check(
      "artisan cannot accept their own quote",
      artisanSelfAccept.error !== null,
      artisanSelfAccept.error ? `blocked: ${artisanSelfAccept.error.message}` : "NOT BLOCKED",
    );

    const accepted = await client.db.rpc("respond_to_quote", {
      p_quote_id: quote!.id,
      p_accept: true,
      p_reason: null,
    });
    check(
      "client accepts, job moves to awaiting_deposit",
      accepted.error === null && accepted.data === "awaiting_deposit",
      accepted.error?.message ?? `returned ${accepted.data}`,
    );

    console.log("\n  Audit trail\n");

    const { data: events } = await admin
      .from("job_events")
      .select("from_status, to_status")
      .eq("job_id", job)
      .order("created_at");
    check(
      "every transition was logged",
      (events?.length ?? 0) >= 4,
      events?.map((e) => e.to_status).join(" → ") ?? "none",
    );
  } finally {
    if (jobId) {
      // Past `draft`, so the client's own DELETE policy no longer covers it.
      await admin.from("jobs").delete().eq("id", jobId);
      console.log("\n  Test job removed.");
    }
  }

  // Deliberately after the cleanup above, not inside it. `find_candidate_providers`
  // excludes an artisan who already has a job in flight — correctly — so while
  // the first job existed the matcher had nobody to offer the second one to.
  await runDeclinePaths();

  console.log(failures === 0 ? "\n  Phase 3 path works end to end.\n" : `\n  ${failures} FAILED.\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

void main();
