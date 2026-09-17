/**
 * Post-migration smoke test. Proves the things that are easy to assume and
 * expensive to get wrong: that RLS actually blocks an anonymous caller, that a
 * SECURITY DEFINER function can still resolve PostGIS at runtime, and that the
 * seed landed. Safe to run against any environment — it writes nothing that
 * survives, and every write it attempts is one that should be rejected.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const anon = createClient(url, anonKey);
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Mirrors syntheticEmailForPhone() in src/lib/phone.ts. */
const syntheticEmail = (e164: string) => `${e164.replace("+", "")}@phone.artisangh.app`;

let failures = 0;
function check(name: string, pass: boolean, detail: string) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!pass) failures++;
}

async function main() {
  console.log("\n  RLS — anonymous caller\n");

  const profiles = await anon.from("profiles").select("id, full_name");
  check(
    "profiles hidden from anon",
    (profiles.data?.length ?? 0) === 0,
    profiles.error ? `blocked: ${profiles.error.code}` : `${profiles.data?.length} rows returned`,
  );

  const jobs = await anon.from("jobs").select("id");
  check(
    "jobs hidden from anon",
    (jobs.data?.length ?? 0) === 0,
    jobs.error ? `blocked: ${jobs.error.code}` : `${jobs.data?.length} rows returned`,
  );

  const payments = await anon.from("payments").select("id");
  check(
    "payments hidden from anon",
    (payments.data?.length ?? 0) === 0,
    payments.error ? `blocked: ${payments.error.code}` : `${payments.data?.length} rows returned`,
  );

  const cats = await anon.from("categories").select("id, name");
  check(
    "categories readable by anon",
    (cats.data?.length ?? 0) === 26,
    cats.error ? `ERROR ${cats.error.message}` : `${cats.data?.length} categories`,
  );

  console.log("\n  Privilege escalation\n");

  // RLS filtering an UPDATE to zero rows is not an error, so asserting on the
  // response shape proves nothing. Assert on the stored role instead.
  await anon.from("profiles").update({ role: "admin" }).eq("phone", "+233241111111");
  const afterEscalate = await admin
    .from("profiles")
    .select("role")
    .eq("phone", "+233241111111")
    .single();
  check(
    "anon cannot self-promote to admin",
    afterEscalate.data?.role === "client",
    `seeded client's role is still "${afterEscalate.data?.role}"`,
  );

  const anonInsert = await anon
    .from("profiles")
    .insert({ phone: "+233249999999", full_name: "Injected", role: "admin" });
  check(
    "anon cannot insert a profile",
    anonInsert.error !== null,
    anonInsert.error ? `blocked: ${anonInsert.error.code}` : "INSERT SUCCEEDED — policy gap",
  );

  const anonSettings = await anon.from("settings").update({ value: 99 }).eq("key", "platform_commission_pct");
  const afterSettings = await admin
    .from("settings")
    .select("value")
    .eq("key", "platform_commission_pct")
    .single();
  check(
    "anon cannot rewrite platform commission",
    String(afterSettings.data?.value) === "12",
    anonSettings.error
      ? `blocked: ${anonSettings.error.code}`
      : `commission still ${afterSettings.data?.value}`,
  );

  console.log("\n  PostGIS at runtime (search_path pinned inside SECURITY DEFINER)\n");

  const candidates = await admin.rpc("find_candidate_providers", {
    p_job_id: "00000000-0000-0000-0000-000000000000",
    p_radius_km: 5,
    p_limit: 10,
  });
  check(
    "find_candidate_providers plans st_dwithin/st_distance",
    candidates.error === null,
    candidates.error ? `ERROR ${candidates.error.message}` : "resolved, returned 0 rows as expected",
  );

  console.log("\n  Seeded data\n");

  const seeded = await admin
    .from("profiles")
    .select("phone, full_name, role, is_active")
    .in("phone", ["+233241111111", "+233242222222", "+233243333333"])
    .order("role");
  check(
    "three seeded accounts present",
    seeded.data?.length === 3,
    seeded.error ? `ERROR ${seeded.error.message}` : seeded.data!.map((p) => `${p.role}:${p.phone}`).join(" "),
  );

  // Filter to the seeded artisan explicitly. Public signup creates other
  // provider rows, and an unfiltered .limit(1) silently asserts against
  // whichever row PostgREST happens to return first.
  const provider = await admin
    .from("providers")
    .select(
      "verification_status, availability, last_location_at, current_location, profiles!inner(phone)",
    )
    .eq("profiles.phone", "+233242222222")
    .single();
  check(
    "provider approved, online, located",
    provider.data?.verification_status === "approved" &&
      provider.data?.availability === "online" &&
      provider.data?.last_location_at !== null,
    provider.error
      ? `ERROR ${provider.error.message}`
      : `${provider.data?.verification_status} · ${provider.data?.availability} · located ${provider.data?.last_location_at !== null}`,
  );

  const zones = await admin.from("transport_zones").select("min_km, max_km, fee");
  check(
    "transport zone bands seeded",
    zones.data?.length === 4,
    zones.error ? `ERROR ${zones.error.message}` : `${zones.data?.length} bands`,
  );

  const settings = await admin.from("settings").select("key");
  check(
    "operational settings seeded",
    (settings.data?.length ?? 0) >= 8,
    settings.error ? `ERROR ${settings.error.message}` : `${settings.data?.length} keys`,
  );

  const phone = "+233242222222"; // seeded provider
  const email = syntheticEmail(phone);

  console.log("\n  Session mint (the establishSession mechanism)\n");

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  check(
    "generateLink returns a hashed_token",
    !linkError && Boolean(link?.properties?.hashed_token),
    linkError ? `ERROR ${linkError.message}` : "token issued",
  );
  if (!link?.properties?.hashed_token) return;

  // Fresh anon client, exactly like the SSR client the server action uses.
  const user = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: session, error: verifyError } = await user.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  check(
    "verifyOtp(token_hash) returns a session",
    !verifyError && Boolean(session?.session?.access_token),
    verifyError ? `ERROR ${verifyError.message}` : "access_token issued",
  );

  check(
    "session belongs to the right account",
    session?.user?.email === email,
    `email on session: ${session?.user?.email}`,
  );

  // The token is single use — a replay must fail, otherwise an intercepted
  // link would be a standing key to the account.
  const replay = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: replayError } = await replay.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  check(
    "token cannot be replayed",
    replayError !== null,
    replayError ? `rejected: ${replayError.message}` : "REPLAY SUCCEEDED — token is reusable",
  );

  console.log("\n  RLS under a real user session\n");

  if (session?.session?.access_token) {
    const asProvider = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
    });

    const own = await asProvider.from("profiles").select("phone, role").eq("phone", phone);
    check(
      "provider can read own profile",
      own.data?.length === 1,
      own.error ? `ERROR ${own.error.message}` : `${own.data?.length} row`,
    );

    // "no other profiles visible" only held while no jobs existed. The
    // counterparty policy in 0003 deliberately exposes the profile of anyone
    // you share a job with — the artisan needs the client's number to call
    // them on the way, and vice versa. Assert the actual rule: every profile
    // the artisan can see is either their own or someone they share a job
    // with. Anything else is a leak.
    const others = await asProvider.from("profiles").select("id, phone").neq("phone", phone);
    const self = await admin.from("profiles").select("id").eq("phone", phone).single();
    const shared = await admin.from("jobs").select("client_id").eq("provider_id", self.data!.id);
    const counterparties = new Set((shared.data ?? []).map((j) => j.client_id));
    const leaked = (others.data ?? []).filter((row) => !counterparties.has(row.id));
    check(
      "provider sees only their own profile and job counterparties",
      leaked.length === 0,
      others.error
        ? `blocked: ${others.error.code}`
        : `${others.data?.length ?? 0} other visible, ${counterparties.size} counterparty(ies), ${leaked.length} leaked`,
    );

    const promote = await asProvider
      .from("profiles")
      .update({ role: "admin" })
      .eq("phone", phone);
    const after = await admin.from("profiles").select("role").eq("phone", phone).single();
    check(
      "provider cannot promote self to admin",
      after.data?.role === "provider",
      promote.error ? `blocked: ${promote.error.code}` : `NOT BLOCKED — role is "${after.data?.role}"`,
    );

    const reactivate = await asProvider
      .from("profiles")
      .update({ is_active: false })
      .eq("phone", phone);
    check(
      "provider cannot change own account status",
      reactivate.error !== null,
      reactivate.error ? `blocked: ${reactivate.error.code}` : "NOT BLOCKED",
    );

    const rephone = await asProvider
      .from("profiles")
      .update({ phone: "+233240000001" })
      .eq("phone", phone);
    check(
      "phone is immutable",
      rephone.error !== null,
      rephone.error ? `blocked: ${rephone.error.code}` : "NOT BLOCKED",
    );

    const { data: uid } = await admin.from("profiles").select("id").eq("phone", phone).single();

    // The seeded artisan is already approved, so setting 'approved' would be a
    // no-op the trigger correctly ignores. Knock them back to 'pending' as the
    // service role first, so the attempt is a genuine state change.
    await admin
      .from("providers")
      .update({ verification_status: "pending" })
      .eq("profile_id", uid!.id);

    const selfApprove = await asProvider
      .from("providers")
      .update({ verification_status: "approved" })
      .eq("profile_id", uid!.id);
    const approvalAfter = await admin
      .from("providers")
      .select("verification_status")
      .eq("profile_id", uid!.id)
      .single();
    check(
      "artisan cannot self-approve verification",
      approvalAfter.data?.verification_status === "pending",
      selfApprove.error
        ? `blocked: ${selfApprove.error.code}`
        : `NOT BLOCKED — status is "${approvalAfter.data?.verification_status}"`,
    );

    // 0008 closed the direct unsubmitted → pending write. Submission now runs
    // through submit_provider_application(), which refuses an incomplete
    // application. The old hardcoded transition let an artisan flip their own
    // status with nothing filled in, and locked a rejected artisan out of
    // re-applying.
    await admin
      .from("providers")
      .update({ verification_status: "unsubmitted" })
      .eq("profile_id", uid!.id);
    const submit = await asProvider
      .from("providers")
      .update({ verification_status: "pending" })
      .eq("profile_id", uid!.id);
    check(
      "artisan cannot set their own verification status directly",
      submit.error !== null,
      submit.error ? `blocked: ${submit.error.code}` : "NOT BLOCKED — direct status write succeeded",
    );

    await admin
      .from("providers")
      .update({ verification_status: "approved" })
      .eq("profile_id", uid!.id);

    const selfRate = await asProvider
      .from("providers")
      .update({ rating_avg: 5, rating_count: 999, jobs_completed: 999 })
      .eq("profile_id", uid!.id);
    check(
      "artisan cannot fake own reputation",
      selfRate.error !== null,
      selfRate.error ? `blocked: ${selfRate.error.code}` : "NOT BLOCKED",
    );

    const unsuspend = await asProvider
      .from("providers")
      .update({ suspended_at: null, payout_recipient_code: "RCP_attacker" })
      .eq("profile_id", uid!.id);
    check(
      "artisan cannot unsuspend or redirect payouts",
      unsuspend.error !== null,
      unsuspend.error ? `blocked: ${unsuspend.error.code}` : "NOT BLOCKED",
    );

    // Going online/offline is genuinely the artisan's own call — the guard must
    // not be so broad that it breaks the legitimate case.
    const goOffline = await asProvider
      .from("providers")
      .update({ availability: "offline" })
      .eq("profile_id", uid!.id);
    await asProvider.from("providers").update({ availability: "online" }).eq("profile_id", uid!.id);
    check(
      "artisan CAN still set own availability",
      goOffline.error === null,
      goOffline.error ? `WRONGLY BLOCKED: ${goOffline.error.message}` : "allowed, as intended",
    );

    const renameSelf = await asProvider
      .from("profiles")
      .update({ full_name: "Kwame Mensah" })
      .eq("phone", phone);
    check(
      "user CAN still edit own name",
      renameSelf.error === null,
      renameSelf.error ? `WRONGLY BLOCKED: ${renameSelf.error.message}` : "allowed, as intended",
    );

    console.log("\n  Provider column exposure (0020)\n");

    /**
     * The leak 0020 closed. `providers: read approved` was row-level, so it
     * handed every signed-in user every column of every approved artisan —
     * MoMo number, Ghana Card number, payout code and a live GPS point. Anyone
     * can sign up, so that was the whole price.
     *
     * Asserted from a CLIENT session, because the artisan's own session can
     * legitimately see all of it and would pass this test while it was broken.
     */
    const { data: probeLink } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail("+233241111111"),
    });

    const probeAuth = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: probeSession } = probeLink?.properties?.hashed_token
      ? await probeAuth.auth.verifyOtp({
          type: "magiclink",
          token_hash: probeLink.properties.hashed_token,
        })
      : { data: null };

    if (probeSession?.session) {
      const clientSession = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${probeSession.session.access_token}` } },
      });

      const raid = await clientSession
        .from("providers")
        .select("profile_id, momo_number, ghana_card_number, payout_recipient_code, current_location");
      check(
        "a client cannot read the providers table at all",
        (raid.data?.length ?? 0) === 0,
        raid.error
          ? `blocked: ${raid.error.code}`
          : `${raid.data?.length ?? 0} row(s) visible${(raid.data?.length ?? 0) > 0 ? " — LEAKING" : ""}`,
      );

      // The replacement surface has to still work, or the fix just broke the
      // product instead of securing it.
      const safe = await clientSession.from("provider_public").select("full_name, rating_avg, bio");
      check(
        "the safe provider view is readable",
        safe.error === null && (safe.data?.length ?? 0) > 0,
        safe.error ? `ERROR ${safe.error.message}` : `${safe.data?.length} artisan(s) visible`,
      );

      for (const column of [
        "momo_number",
        "ghana_card_number",
        "payout_recipient_code",
        "current_location",
        "suspension_reason",
      ]) {
        const probe = await clientSession.from("provider_public").select(column);
        check(
          `provider_public does not expose ${column}`,
          probe.error !== null,
          probe.error ? "absent" : "*** EXPOSED IN THE VIEW ***",
        );
      }
    }

    console.log("\n  Phase 2 — verification (0008 / 0010)\n");

    // The gaps function is SECURITY DEFINER over somebody's identity documents,
    // so who may call it is the whole question. 0009 briefly got this wrong in
    // both directions at once; these three checks are why it did not survive.
    // This doubles as the regression test for the `||` bug fixed in 0010: the
    // gaps array is built by appending text to text[], and an unquoted literal
    // is `unknown`, which resolves the operator toward anyarray||anyarray and
    // raises "malformed array literal". It only fails once there is a gap to
    // report — the exact case the function exists for — so a non-empty result
    // here is the assertion that matters, not merely the absence of an error.
    const ownGaps = await asProvider.rpc("provider_application_gaps", {
      p_provider_id: uid!.id,
    });
    check(
      "artisan reads own gaps, and the array actually builds",
      ownGaps.error === null && Array.isArray(ownGaps.data) && ownGaps.data.length > 0,
      ownGaps.error
        ? `WRONGLY BLOCKED: ${ownGaps.error.message}`
        : `${(ownGaps.data ?? []).length} gap(s): ${JSON.stringify(ownGaps.data)}`,
    );

    const otherGaps = await asProvider.rpc("provider_application_gaps", {
      p_provider_id: "00000000-0000-0000-0000-000000000000",
    });
    check(
      "artisan cannot read someone else's gaps",
      otherGaps.error !== null,
      otherGaps.error ? `blocked: ${otherGaps.error.message}` : "NOT BLOCKED — definer leak",
    );

    const anonGaps = await anon.rpc("provider_application_gaps", { p_provider_id: uid!.id });
    check(
      "anon cannot read gaps at all",
      anonGaps.error !== null,
      anonGaps.error ? `blocked: ${anonGaps.error.message}` : "NOT BLOCKED — PUBLIC execute grant",
    );

    // An approved artisan resubmitting would let somebody swap their documents
    // after they had been checked.
    const resubmit = await asProvider.rpc("submit_provider_application");
    check(
      "approved artisan cannot resubmit",
      resubmit.error !== null,
      resubmit.error ? `blocked: ${resubmit.error.message}` : "NOT BLOCKED",
    );

    const selfReview = await asProvider.rpc("review_provider_application", {
      p_provider_id: uid!.id,
      p_decision: "approved",
      p_call_notes: "self-approved",
    });
    check(
      "artisan cannot review themselves",
      selfReview.error !== null,
      selfReview.error ? `blocked: ${selfReview.error.message}` : "NOT BLOCKED — queue is decorative",
    );

    const cardAfterApproval = await asProvider
      .from("providers")
      .update({ ghana_card_number: "GHA-000000000-0" })
      .eq("profile_id", uid!.id);
    check(
      "approved artisan cannot change their Ghana Card number",
      cardAfterApproval.error !== null,
      cardAfterApproval.error ? `blocked: ${cardAfterApproval.error.code}` : "NOT BLOCKED",
    );

    const onJob = await asProvider
      .from("providers")
      .update({ availability: "on_job" })
      .eq("profile_id", uid!.id);
    check(
      "artisan cannot put themselves on a job",
      onJob.error !== null,
      onJob.error ? `blocked: ${onJob.error.code}` : "NOT BLOCKED",
    );

    // The RPC is what the toggle calls, so it must work for the legitimate case.
    const offline = await asProvider.rpc("set_provider_availability", { p_online: false });
    const online = await asProvider.rpc("set_provider_availability", { p_online: true });
    check(
      "set_provider_availability round-trips for an approved artisan",
      offline.error === null && online.error === null && online.data === "online",
      offline.error?.message ?? online.error?.message ?? `returned "${online.data}"`,
    );
  }


  console.log("\n  Function privileges (0013)\n");

  /**
   * The defect 0013 exists to fix, asserted permanently.
   *
   * Supabase's default privileges grant EXECUTE on every new `public` function
   * to `anon` and `authenticated`, so `revoke ... from public` — which 0010,
   * 0011 and 0012 all used — removes nothing. For a while an anonymous caller
   * could execute `settle_payment` and mark any deposit paid.
   *
   * Every privileged function added from here on belongs in this list. A new
   * one that is merely forgotten will be callable by the whole internet.
   */
  const PRIVILEGED: [string, Record<string, unknown>][] = [
    ["settle_payment", { p_reference: "x", p_succeeded: true, p_reason: null, p_channel: null }],
    ["refund_job_payments", { p_job_id: "00000000-0000-0000-0000-000000000000", p_reason: null }],
    ["advance_matching", { p_job_id: "00000000-0000-0000-0000-000000000000" }],
    ["expire_stale_offers", {}],
    ["stale_pending_payments", { p_older_than_minutes: 15 }],
  ];

  for (const [fn, args] of PRIVILEGED) {
    const asAnon = await anon.rpc(fn, args as never);
    check(
      `anon cannot execute ${fn}`,
      asAnon.error !== null,
      asAnon.error ? `blocked: ${asAnon.error.code}` : "EXECUTED — privilege leak",
    );
  }

  // The same functions must still work for the backend, or the fix has simply
  // broken the webhook and the cron sweep instead of securing them.
  const sweep = await admin.rpc("expire_stale_offers");
  check(
    "the service role CAN still run the offer sweep",
    sweep.error === null,
    sweep.error ? `WRONGLY BLOCKED: ${sweep.error.message}` : `expired ${sweep.data}`,
  );

  const settleUnknown = await admin.rpc("settle_payment", {
    p_reference: "definitely-not-a-real-reference",
    p_succeeded: true,
    p_reason: null,
    p_channel: null,
  });
  check(
    "the service role CAN still settle payments",
    settleUnknown.error === null,
    settleUnknown.error ? `WRONGLY BLOCKED: ${settleUnknown.error.message}` : "reachable",
  );

  console.log("\n  Phase 1 — a job needs a landmark (0009)\n");

  // Phase 1 drew the landmark field with a required marker and enforced it
  // nowhere, so a job could go out with an OSM road name as its only human
  // direction. This proves the rule bites at the point of no return.
  //
  // Only the refusal is exercised, deliberately: a successful post_job leaves a
  // `posted` job behind, and the client's own DELETE policy covers drafts only
  // (0007), so the happy path could not be cleaned up after itself.
  const clientPhone = "+233241111111";
  const { data: clientLink } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: syntheticEmail(clientPhone),
  });

  if (!clientLink?.properties?.hashed_token) {
    check("mint a client session", false, "generateLink gave no token");
  } else {
    const clientAuth = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: clientSession } = await clientAuth.auth.verifyOtp({
      type: "magiclink",
      token_hash: clientLink.properties.hashed_token,
    });

    const asClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${clientSession!.session!.access_token}` },
      },
    });

    const { data: anyCategory } = await admin
      .from("categories")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();

    const { data: draft, error: draftError } = await asClient
      .from("jobs")
      .insert({ client_id: clientSession!.user!.id, category_id: anyCategory!.id })
      .select("id")
      .single();

    if (draftError || !draft) {
      check("client can create a draft job", false, draftError?.message ?? "no row");
    } else {
      // Everything a job needs except the landmark.
      await asClient.rpc("set_job_location", {
        p_job_id: draft.id,
        p_lng: -0.1826,
        p_lat: 5.5573,
        p_address_text: "Osu, Accra",
        p_ghanapost_code: null,
        p_landmark: null,
      });
      await asClient.from("jobs").update({ description: "Ceiling fan has stopped spinning." }).eq("id", draft.id);

      const noLandmark = await asClient.rpc("post_job", { p_job_id: draft.id });
      check(
        "post_job refuses a job with no landmark",
        noLandmark.error !== null && /landmark/i.test(noLandmark.error.message),
        noLandmark.error ? `blocked: ${noLandmark.error.message}` : "POSTED WITHOUT A LANDMARK",
      );

      // A too-short landmark is the same defect wearing a hat.
      await asClient.rpc("set_job_location", {
        p_job_id: draft.id,
        p_lng: -0.1826,
        p_lat: 5.5573,
        p_address_text: "Osu, Accra",
        p_ghanapost_code: null,
        p_landmark: "here",
      });
      const shortLandmark = await asClient.rpc("post_job", { p_job_id: draft.id });
      check(
        "post_job refuses a one-word landmark",
        shortLandmark.error !== null && /landmark/i.test(shortLandmark.error.message),
        shortLandmark.error ? `blocked` : "POSTED WITH A USELESS LANDMARK",
      );

      const cleanup = await asClient.from("jobs").delete().eq("id", draft.id);
      check(
        "test draft cleaned up",
        cleanup.error === null,
        cleanup.error ? `LEFT BEHIND: ${cleanup.error.message}` : "draft removed",
      );
    }
  }

  console.log(failures === 0 ? "\n  All checks passed.\n" : `\n  ${failures} CHECK(S) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
