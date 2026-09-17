/**
 * Render smoke test.
 *
 * `next build` passes on pages that crash the instant they are actually
 * rendered — a function prop crossing the server/client boundary is a runtime
 * serialization failure, not a type error, and every job route is dynamic so
 * nothing is prerendered at build time. That is exactly how "Event handlers
 * cannot be passed to Client Component props" reached a user.
 *
 * So this fetches the real routes from a running dev server with a real session
 * cookie and fails on an error page. Run it against `npm run dev`:
 *
 *   npm run smoke
 *
 * **What it does not catch**, and deliberately does not try to: a function prop
 * crossing the server/client boundary. That check fires during a real browser's
 * Flight render, so `fetch` of the same URL returns a clean 200 with plausible
 * HTML — verified by reintroducing the bug and watching this file pass. That
 * class belongs to `npm run check:props`, which finds it statically in a second.
 *
 * What this DOES catch is everything that shows up once a page is rendered with
 * real data: a broken embed, a bad RLS assumption, a 500. It found
 * `listUnmatchedJobs` failing on a wrong foreign-key hint — which typechecked,
 * linted, built, and silently rendered the admin's queue empty.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const origin = process.env.SMOKE_ORIGIN ?? "http://localhost:3000";

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;
function check(name: string, pass: boolean, detail: string) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!pass) failures++;
}

const syntheticEmail = (e164: string) => `${e164.replace("+", "")}@phone.artisangh.app`;
const projectRef = new URL(url).hostname.split(".")[0];

/**
 * The cookie `@supabase/ssr` writes, rebuilt by hand.
 *
 * It is a `base64-` prefixed JSON session, split into `.0`, `.1` … chunks past
 * ~3180 characters. Reproducing the chunking matters: a truncated single cookie
 * reads as a signed-out user and every assertion below would pass by rendering
 * the login page.
 */
function sessionCookies(session: Record<string, unknown>): string {
  const name = `sb-${projectRef}-auth-token`;
  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;

  const CHUNK = 3180;
  if (encoded.length <= CHUNK) return `${name}=${encoded}`;

  const parts: string[] = [];
  for (let i = 0; i * CHUNK < encoded.length; i++) {
    parts.push(`${name}.${i}=${encoded.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  }
  return parts.join("; ");
}

async function sessionCookieFor(phone: string) {
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: syntheticEmail(phone),
  });
  if (error || !link?.properties?.hashed_token) {
    throw new Error(`generateLink failed for ${phone}: ${error?.message}`);
  }

  const auth = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error: verifyError } = await auth.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError || !data.session) {
    throw new Error(`verifyOtp failed for ${phone}: ${verifyError?.message}`);
  }

  return { cookie: sessionCookies(data.session as never), userId: data.user!.id };
}

/** The strings Next puts in a response body when a Server Component blows up. */
const CRASH_SIGNATURES = [
  "Event handlers cannot be passed to Client Component props",
  "Functions cannot be passed directly to Client Components",
  "Application error: a server-side exception",
  "Internal Server Error",
  "__next_error__",
];

/**
 * The dev server's own log, which is the only place some failures show up.
 *
 * A function prop crossing the server/client boundary does not appear in the
 * response body and does not change the status code — the document still comes
 * back 200 with plausible HTML. It is reported to the dev overlay and written
 * here. Asserting only on what `fetch` can see would have called the reported
 * bug a pass, which is exactly what an earlier version of this file did.
 */
const DEV_LOG = ".next/dev/logs/next-development.log";

function devLogErrorCount(): number {
  try {
    const text = readFileSync(DEV_LOG, "utf8");
    return text
      .split("\n")
      .filter((line) => /"level":"ERROR"/.test(line) && !/\[browser\]/.test(line)).length;
  } catch {
    return 0;
  }
}

/**
 * Both ways a page is actually reached.
 *
 * This distinction is the whole point of the file. A plain document request
 * renders the page to HTML; an `RSC: 1` request returns the Flight payload that
 * a *client-side navigation* consumes — and a Server Action's `redirect()` is a
 * client-side navigation. The reported crash happened on exactly that path:
 * submit the location step, get redirected to review. The document request for
 * the same URL rendered fine, which is why the bug survived a build, a lint and
 * a manual look at the page.
 *
 * Testing only the document request is testing the one route the user was not
 * taking.
 */
async function render(label: string, path: string, cookie: string) {
  await request(`${label} (document)`, path, cookie, {});
  await request(`${label} (navigation)`, path, cookie, { RSC: "1" });
}

async function request(
  label: string,
  path: string,
  cookie: string,
  extraHeaders: Record<string, string>,
) {
  // Followed, not manual. Next normalises an `RSC: 1` request to a `?_rsc=`
  // URL with a 307, which is routing bookkeeping rather than a rejection — the
  // only redirect that matters here is one that lands on /login.
  const response = await fetch(`${origin}${path}`, {
    headers: { cookie, ...extraHeaders },
    redirect: "follow",
  });

  // Landing on /login means the cookie did not take, which would make every
  // other assertion here meaningless — a login page renders perfectly.
  if (new URL(response.url).pathname.startsWith("/login")) {
    check(label, false, "redirected to /login — session cookie rejected");
    return;
  }

  const html = await response.text();
  const crash = CRASH_SIGNATURES.find((signature) => html.includes(signature));

  check(
    label,
    response.status === 200 && !crash,
    crash ? `HTTP ${response.status}, CRASHED: ${crash}` : `HTTP ${response.status}, rendered`,
  );
}

async function main() {
  // Sampled before anything is rendered, so only errors this run provoked count.
  const errorsAtStart = devLogErrorCount();
  const client = await sessionCookieFor("+233241111111");
  let draftId: string | null = null;
  let postedId: string | null = null;

  try {
    const { data: category } = await admin
      .from("categories")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();

    // A complete draft, so the review step renders the map preview rather than
    // the empty state — the empty state is not what was crashing.
    const { data: draft } = await admin
      .from("jobs")
      .insert({ client_id: client.userId, category_id: category!.id })
      .select("id")
      .single();
    draftId = draft!.id;

    await admin.rpc("set_job_location", {
      p_job_id: draftId,
      p_lng: -0.1805,
      p_lat: 5.5561,
      p_address_text: "Osu, Accra",
      p_ghanapost_code: "GA-543-0125",
      p_landmark: "Blue gate opposite the pharmacy",
    });
    await admin
      .from("jobs")
      .update({ description: "Two kitchen sockets have stopped working." })
      .eq("id", draftId);

    // A second job, posted, for the client's job screen — which renders the
    // same read-only map and had the identical defect waiting in it.
    const { data: posted } = await admin
      .from("jobs")
      .insert({ client_id: client.userId, category_id: category!.id })
      .select("id")
      .single();
    postedId = posted!.id;

    await admin.rpc("set_job_location", {
      p_job_id: postedId,
      p_lng: -0.1805,
      p_lat: 5.5561,
      p_address_text: "Osu, Accra",
      p_ghanapost_code: null,
      p_landmark: "Blue gate opposite the pharmacy",
    });
    await admin
      .from("jobs")
      .update({ description: "Socket sparking.", status: "posted" })
      .eq("id", postedId);

    console.log(`\n  Rendering against ${origin}\n`);

    await render("client dashboard", "/client", client.cookie);
    await render("posting — describe", `/client/post/${draftId}/describe`, client.cookie);
    await render("posting — location", `/client/post/${draftId}/location`, client.cookie);
    await render("posting — review (the reported crash)", `/client/post/${draftId}/review`, client.cookie);
    await render("job detail (same defect)", `/client/jobs/${postedId}`, client.cookie);
    await render("job history", "/client/jobs", client.cookie);

    const provider = await sessionCookieFor("+233242222222");
    await render("provider dashboard", "/provider", provider.cookie);

    const adminUser = await sessionCookieFor("+233243333333");
    await render("admin dashboard", "/admin", adminUser.cookie);
    await render("verification queue", "/admin/verification", adminUser.cookie);
    await render("stalled jobs", "/admin/matching", adminUser.cookie);
    await render("transport bands", "/admin/zones", adminUser.cookie);

    // Give the server a moment to flush anything it logged while rendering.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const logged = devLogErrorCount() - errorsAtStart;
    check(
      "the dev server logged no render errors",
      logged === 0,
      logged === 0 ? "clean" : `${logged} server error(s) — check ${DEV_LOG}`,
    );
  } finally {
    for (const id of [draftId, postedId]) {
      if (id) await admin.from("jobs").delete().eq("id", id);
    }
  }

  console.log(failures === 0 ? "\n  Every screen renders.\n" : `\n  ${failures} SCREEN(S) BROKEN.\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

void main();
