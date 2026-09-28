/**
 * Em-dashes in text a user actually sees.
 *
 *   npm run dev        # in another terminal
 *   npm run copy:audit
 *
 * **Why this is not a grep.** The house style uses em-dashes freely in code
 * comments and never in rendered copy, and no regex can reliably tell the two
 * apart: a `/* ... *\/` block spanning ten lines looks exactly like prose to
 * `grep -v`. Grepping this repo returns 135 candidate lines, of which about
 * twenty are real. Reading `innerText` off the running pages returns only the
 * real ones, because it sees what the browser sees.
 *
 * It also checks `placeholder`, `aria-label` and `title`, which render as text
 * to a user or a screen reader but never appear in `innerText`.
 */
import { config } from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const ORIGIN = "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function cookieFor(userId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user!.email! });
  const auth = createClient(url, anon, { auth: { persistSession: false } });
  const { data } = await auth.auth.verifyOtp({ type: "magiclink", token_hash: link!.properties!.hashed_token! });
  const ref = new URL(url).hostname.split(".")[0];
  return { name: `sb-${ref}-auth-token`,
    value: `base64-${Buffer.from(JSON.stringify(data.session)).toString("base64")}`,
    domain: "localhost", path: "/" };
}

const CLIENT = "bcb3856f-7fea-4c79-9e17-39295910be6a";
const APPLICANT = "8404b12b-f236-443a-9f15-0371a4b6e302";
const ADMIN_ID = "f3e0a9db-2110-4f5a-ae5c-0c8c465f610e";
const PROVIDER = "19023409-2933-41c5-879b-69b89a93d47c";

const ROUTES: [string, string | null][] = [
  ["/", null], ["/legal", null], ["/welcome", CLIENT],
  ["/client", CLIENT], ["/client/jobs", CLIENT], ["/client/account", CLIENT],
  ["/provider", PROVIDER], ["/provider/earnings", PROVIDER], ["/provider/jobs", PROVIDER],
  ["/provider/apply/trades", APPLICANT], ["/provider/apply/about", APPLICANT],
  ["/provider/apply/documents", APPLICANT], ["/provider/apply/payout", APPLICANT],
  ["/provider/apply/review", APPLICANT],
  ["/admin", ADMIN_ID], ["/admin/jobs", ADMIN_ID], ["/admin/transactions", ADMIN_ID],
  ["/admin/verification", ADMIN_ID], ["/admin/settings", ADMIN_ID], ["/admin/zones", ADMIN_ID],
];

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  let total = 0;
  for (const [route, user] of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (user) await ctx.addCookies([await cookieFor(user)]);
    const page = await ctx.newPage();
    try {
      await page.goto(`${ORIGIN}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(400);
      // Visible text, plus the attributes that render as text to a user.
      /**
       * Passed as a string on purpose.
       *
       * tsx compiles this file with esbuild, which rewrites arrow functions
       * and injects a `__name` helper for them. That helper does not exist in
       * the page, so a function-valued `evaluate` throws `__name is not
       * defined` - and the catch below turned every route into a SKIP while
       * the script still printed a confident "0 lines found". A string is
       * handed to the browser untouched.
       */
      const found: string[] = await page.evaluate(`(() => {
        const hits = [];
        const push = (s) => { if (s && /[\u2013\u2014]/.test(s)) hits.push(s); };
        push(document.body.innerText);
        document.querySelectorAll('[placeholder]').forEach((el) => push(el.getAttribute('placeholder')));
        document.querySelectorAll('[aria-label]').forEach((el) => push(el.getAttribute('aria-label')));
        document.querySelectorAll('[title]').forEach((el) => push(el.getAttribute('title')));
        return hits;
      })()`);

      // innerText comes back as one blob; split to the offending lines only.
      const lines = found.flatMap((h) => h.split("\n")).filter((l) => /[–—]/.test(l));
      const unique = [...new Set(lines.map((l) => l.trim()))];
      if (unique.length) {
        console.log(`\n  ${route}`);
        for (const l of unique) console.log(`    ${l.slice(0, 92)}`);
        total += unique.length;
      }
    } catch (e) {
      console.log(`  ${route}  SKIP (${(e as Error).message.slice(0, 40)})`);
    }
    await ctx.close();
  }
  console.log(`\n  ${total} line(s) with an em or en dash in rendered text.\n`);
  await browser.close();
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
