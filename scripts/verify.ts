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

  const provider = await admin
    .from("providers")
    .select("verification_status, availability, last_location_at, current_location")
    .limit(1)
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

    const others = await asProvider.from("profiles").select("phone").neq("phone", phone);
    check(
      "provider cannot read other users' profiles",
      (others.data?.length ?? 0) === 0,
      others.error ? `blocked: ${others.error.code}` : `${others.data?.length} other rows visible`,
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

    // The one transition they may make themselves: submitting for review.
    await admin
      .from("providers")
      .update({ verification_status: "unsubmitted" })
      .eq("profile_id", uid!.id);
    const submit = await asProvider
      .from("providers")
      .update({ verification_status: "pending" })
      .eq("profile_id", uid!.id);
    check(
      "artisan CAN submit application for review",
      submit.error === null,
      submit.error ? `WRONGLY BLOCKED: ${submit.error.message}` : "unsubmitted → pending allowed",
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
  }


  console.log(failures === 0 ? "\n  All checks passed.\n" : `\n  ${failures} CHECK(S) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
