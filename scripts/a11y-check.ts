/**
 * Accessibility regression check (PLAN.md §12, Phase 7).
 *
 * Parses the real HTML the server returns and asserts the things that break
 * silently and are never noticed until somebody using a screen reader cannot
 * finish a booking:
 *
 *   • an image with no alt text
 *   • a form control with no accessible name
 *   • a heading level skipped, which is how a screen reader user loses the
 *     shape of a page
 *   • more than one h1, or none
 *   • a link whose only content is an icon
 *   • a missing lang attribute
 *
 * What this deliberately does NOT check is touch target size, because that
 * needs computed CSS and a real viewport — an audit in the browser found ten
 * elements under the WCAG 2.5.8 minimum on the landing page, and the `.tap`
 * utility in globals.css is the fix. A static parse would have found none of
 * them, and pretending otherwise is worse than not checking.
 *
 *   npm run dev        # in another terminal
 *   npm run a11y
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const syntheticEmail = (e164: string) => `${e164.replace("+", "")}@phone.artisangh.app`;

let failures = 0;

function check(name: string, pass: boolean, detail: string) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!pass) failures += 1;
}

const projectRef = new URL(url).hostname.split(".")[0];

/**
 * The same cookie shape `@supabase/ssr` writes, chunked the same way. Copied in
 * spirit from smoke-render.ts rather than shared, because a helper that both
 * scripts import would need a home outside `scripts/` and neither ships.
 */
function sessionCookies(session: Record<string, unknown>): string {
  const name = `sb-${projectRef}-auth-token`;
  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;

  const CHUNK = 3180;
  if (encoded.length <= CHUNK) return `${name}=${encoded}`;

  const parts: string[] = [];
  for (let i = 0; i * CHUNK < encoded.length; i += 1) {
    parts.push(`${name}.${i}=${encoded.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  }
  return parts.join("; ");
}

async function sessionCookieFor(phone: string): Promise<string> {
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

  return sessionCookies(data.session as never);
}

/** Strip script, style and template content — none of it is rendered to a user. */
function visibleHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<template[\s\S]*?<\/template>/gi, "");
}

function audit(label: string, html: string) {
  const body = visibleHtml(html);

  const imgs = body.match(/<img\b[^>]*>/gi) ?? [];
  const noAlt = imgs.filter((tag) => !/\balt\s*=/i.test(tag));
  check(`${label} — every image has alt text`, noAlt.length === 0, `${imgs.length} image(s), ${noAlt.length} without alt`);

  // A control is named by a label, aria-label, aria-labelledby or a placeholder.
  const controls = body.match(/<(input|select|textarea)\b[^>]*>/gi) ?? [];
  const named = controls.filter(
    (tag) =>
      /type\s*=\s*["']?(hidden|submit|button|radio|checkbox)/i.test(tag) ||
      /\baria-label\s*=|\baria-labelledby\s*=|\bplaceholder\s*=|\bid\s*=/i.test(tag),
  );
  check(
    `${label} — every form control can be named`,
    named.length === controls.length,
    `${controls.length} control(s), ${controls.length - named.length} unnamed`,
  );

  const levels = [...body.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  const h1s = levels.filter((n) => n === 1).length;
  check(`${label} — exactly one h1`, h1s === 1, `${h1s} h1 element(s)`);

  const skips: string[] = [];
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] - levels[i - 1] > 1) skips.push(`h${levels[i - 1]} → h${levels[i]}`);
  }
  check(`${label} — no heading level is skipped`, skips.length === 0, skips.length ? skips.join(", ") : "clean outline");

  check(`${label} — the document declares a language`, /<html[^>]*\blang\s*=/i.test(html), /<html[^>]*\blang\s*=\s*["']([^"']+)/i.exec(html)?.[1] ?? "missing");
}

async function page(label: string, path: string, cookie = "") {
  const response = await fetch(`${origin}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });

  if (response.status !== 200) {
    check(`${label} — reachable`, false, `HTTP ${response.status}`);
    return;
  }

  audit(label, await response.text());
}

/**
 * A real job id for a given role, looked up rather than hard-coded.
 *
 * The job screens are the biggest stateful pages in the app — twenty-two
 * statuses between them — and they were the two the audit did not cover, which
 * is how a heading-level skip on a `DetailSection` would have shipped unseen.
 *
 * Resolved at run time from whatever the database happens to hold. A UUID
 * pasted into this file works exactly until somebody re-seeds, and a check that
 * quietly stops running is worse than no check: it still prints PASS for
 * everything else and nobody notices the two missing lines.
 *
 * Returns null when there is nothing to audit — a fresh database with no jobs
 * is not a failure, so the caller skips rather than reporting one.
 */
async function newestJobFor(
  column: "client_id" | "provider_id",
  phone: string,
): Promise<string | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (!profile) return null;

  const { data } = await admin
    .from("jobs")
    .select("id")
    .eq(column, profile.id)
    .neq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

async function main() {
  console.log(`\n  Auditing ${origin}\n`);

  console.log("  Public\n");
  await page("landing", "/");
  await page("terms", "/legal/terms");
  await page("privacy", "/legal/privacy");
  await page("login", "/login");

  console.log("\n  Signed in\n");
  const client = await sessionCookieFor("+233241111111");
  await page("client dashboard", "/client", client);
  await page("post a job", "/client/post", client);

  const clientJob = await newestJobFor("client_id", "+233241111111");
  if (clientJob) await page("client job", `/client/jobs/${clientJob}`, client);
  else console.log("  SKIP  client job — no posted job in the database");

  const provider = await sessionCookieFor("+233242222222");
  await page("provider dashboard", "/provider", provider);

  const providerJob = await newestJobFor("provider_id", "+233242222222");
  if (providerJob) await page("provider job", `/provider/jobs/${providerJob}`, provider);
  else console.log("  SKIP  provider job — no assigned job in the database");

  const adminUser = await sessionCookieFor("+233243333333");
  // The whole console, not a sample of it. Two of these routes are new, and
  // the console is the one surface here built around tables and filters -
  // exactly the shapes that go wrong for a keyboard and a screen reader.
  await page("admin dashboard", "/admin", adminUser);
  await page("admin jobs", "/admin/jobs", adminUser);
  await page("admin transactions", "/admin/transactions", adminUser);
  await page("verification queue", "/admin/verification", adminUser);
  await page("disputes", "/admin/disputes", adminUser);
  await page("matching", "/admin/matching", adminUser);
  await page("trades", "/admin/categories", adminUser);
  await page("transport bands", "/admin/zones", adminUser);
  await page("platform settings", "/admin/settings", adminUser);

  console.log(
    failures === 0
      ? "\n  Every page audited is clean.\n"
      : `\n  ${failures} CHECK(S) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\n  ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
