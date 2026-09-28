/**
 * Hero assets: the two dashboards, at 3x, in their live-job state.
 *
 *   npm run dev          # in another terminal
 *   npm run hero:shots
 *
 * Shot from the running app rather than exported by hand, so the landing page
 * can never advertise a version of the product that no longer exists. Re-run
 * it after any change to either dashboard.
 *
 * It stages a job to `awaiting_deposit`, shoots both dashboards in that state,
 * and deletes the job again. The staging is the point: with no live job both
 * dashboards show their empty state, which is the least persuasive thing the
 * product can look like.
 */
import { config } from "dotenv";
import { chromium } from "playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ORIGIN = "http://localhost:3000";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const email = (e: string) => `${e.replace("+", "")}@phone.artisangh.app`;

async function sessionFor(phone: string) {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: email(phone) });
  const auth = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data } = await auth.auth.verifyOtp({ type: "magiclink", token_hash: link!.properties!.hashed_token });
  return {
    id: data.user!.id,
    session: data.session!,
    db: createClient(url, anonKey, { auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session!.access_token}` } } }) as SupabaseClient,
  };
}

function cookieFor(session: unknown) {
  const ref = new URL(url).hostname.split(".")[0];
  return { name: `sb-${ref}-auth-token`,
    value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`,
    domain: "localhost", path: "/" };
}

async function main() {
  const client = await sessionFor("+233241111111");

  // ---- stage one job to awaiting_deposit ---------------------------------
  const { data: cat } = await admin.from("categories").select("id").eq("slug", "electrical").single();
  const { data: draft } = await client.db.from("jobs")
    .insert({ client_id: client.id, category_id: cat!.id }).select("id, reference").single();
  const jobId = draft!.id as string;

  await client.db.rpc("set_job_location", { p_job_id: jobId, p_lng: -0.1805, p_lat: 5.5561,
    p_address_text: "Osu, Accra", p_ghanapost_code: null, p_landmark: "Blue gate opposite the pharmacy" });
  await client.db.from("jobs").update({ description: "Two kitchen sockets dead and the trip keeps going." }).eq("id", jobId);
  const posted = await client.db.rpc("post_job", { p_job_id: jobId });
  if (posted.error) throw new Error(`post_job: ${posted.error.message}`);

  /**
   * The hero shows a name to a stranger, so it must not be seeded test data.
   * "Payments Test Artisan" turning up on the marketing page is the kind of
   * detail that tells a visitor exactly how finished the product is.
   */
  const HERO_ARTISAN = "+233242222222"; // Kwame Mensah
  const { data: hero } = await admin.from("profiles").select("id, full_name").eq("phone", HERO_ARTISAN).single();

  let { data: offer } = await admin.from("job_offers").select("id, provider_id")
    .eq("job_id", jobId).eq("status", "pending").eq("provider_id", hero!.id).limit(1).maybeSingle();

  if (!offer) {
    // The matcher offered somebody else. Withdraw those and hand it to ours.
    await admin.from("job_offers").update({ status: "declined" }).eq("job_id", jobId).eq("status", "pending");
    const { data: made, error } = await admin.from("job_offers").insert({
      job_id: jobId, provider_id: hero!.id, sequence_no: 99,
      status: "pending", expires_at: new Date(Date.now() + 600_000).toISOString(),
    }).select("id, provider_id").single();
    if (error) throw new Error(`offer: ${error.message}`);
    offer = made;
  }

  const { data: prof } = await admin.from("profiles").select("phone, full_name").eq("id", offer!.provider_id).single();
  const artisan = await sessionFor(prof!.phone);

  await artisan.db.rpc("respond_to_offer", { p_offer_id: offer!.id, p_accept: true });
  const { data: qid } = await artisan.db.rpc("save_quote", { p_job_id: jobId,
    p_items: [{ kind: "labour", description: "Trace fault, replace two sockets", quantity: 1, unit_price: 380 }],
    p_notes: null });
  await artisan.db.rpc("send_quote", { p_quote_id: qid });
  await client.db.rpc("respond_to_quote", { p_quote_id: qid, p_accept: true, p_reason: null });

  const { data: j } = await admin.from("jobs").select("status").eq("id", jobId).single();
  console.log(`  staged ${draft!.reference} -> ${j!.status}, artisan ${prof!.full_name}`);

  // ---- shoot both dashboards at 3x ---------------------------------------
  const browser = await chromium.launch({ channel: "chrome" });

  for (const [who, route, session] of [
    ["client", "/client", client.session],
    ["artisan", "/provider", artisan.session],
  ] as const) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
    });
    await ctx.addCookies([cookieFor(session)]);
    const page = await ctx.newPage();
    await page.goto(`${ORIGIN}${route}`, { waitUntil: "networkidle" });
    // The dev panel and Next's overlay are not part of the product.
    // The dev panel carries no data attribute, only `fixed bottom-24 left-4`.
    await page.addStyleTag({ content: `.fixed.bottom-24.left-4, nextjs-portal,
      [data-nextjs-dev-tools-button], #__next-build-watcher { display: none !important; }` });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `public/img/hero/${who}.png` });
    console.log(`  shot ${route} -> public/img/hero/${who}.png`);
    await ctx.close();
  }
  await browser.close();

  // ---- put the database back ---------------------------------------------
  for (const t of ["payouts","payments","job_photos","job_events","job_offers"]) {
    await admin.from(t).delete().eq("job_id", jobId);
  }
  const { data: qs } = await admin.from("quotes").select("id").eq("job_id", jobId);
  for (const q of qs ?? []) await admin.from("quote_items").delete().eq("quote_id", q.id);
  await admin.from("quotes").delete().eq("job_id", jobId);
  await admin.from("jobs").delete().eq("id", jobId);
  await admin.from("providers").update({ availability: "online" }).eq("availability", "on_job");
  console.log(`  cleaned up ${draft!.reference}`);
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
