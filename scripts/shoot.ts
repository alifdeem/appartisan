/**
 * Design screenshot harness.
 *
 * Drives the running dev server and writes one PNG per route per viewport into
 * `redesign/shots/<label>/`. Two labels matter: `baseline` (captured before any
 * redesign work, so there is proof of what changed) and `current` (re-captured
 * after each page lands).
 *
 * Uses Chrome via `channel: "chrome"` rather than downloading Playwright's
 * bundled Chromium — Chrome is already on this machine and the 130MB download
 * buys nothing for screenshotting our own CSS.
 *
 *   npx tsx scripts/shoot.ts baseline
 *   npx tsx scripts/shoot.ts current  --routes=/
 *
 * Authenticated routes are skipped unless SHOOT_COOKIE is set, because the
 * session is an httpOnly Supabase cookie and faking it here would be a second
 * auth implementation to keep in sync. Phase 0 covers the public pages; the
 * dashboards get captured once we wire a seeded login into this script.
 */
import { chromium, type Browser } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.SHOOT_BASE ?? "http://localhost:3000";

/** The viewports that actually correspond to decisions in the design system. */
const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 800 }, // low-end Android, the real floor
  { name: "mobile-390", width: 390, height: 844 }, // iPhone class
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/legal", "/legal/terms", "/legal/privacy"];

async function shoot(browser: Browser, label: string, routes: string[]) {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      // Coarse pointer changes real behaviour in this codebase — the `.tap`
      // utility only grows hit areas on touch, so a desktop-emulated phone
      // screenshot would not match what a phone renders.
      hasTouch: vp.width < 768,
      isMobile: vp.width < 768,
      colorScheme: "light",
    });

    const page = await context.newPage();

    for (const route of routes) {
      const slug = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-");
      const dir = path.join("redesign", "shots", label, vp.name);
      await mkdir(dir, { recursive: true });

      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });

      // The dev overlay is `position: fixed`, so in a full-page screenshot it
      // renders wherever the viewport happened to be — a stray badge floating
      // in the middle of the page that looks like a layout bug in review.
      await page.addStyleTag({ content: "nextjs-portal{display:none !important}" });

      // next/image lazy-loads anything below the fold, and a full-page
      // screenshot never scrolls — so every image past the first viewport
      // photographs as an empty box. Walk the page to trigger them, then go
      // back to the top so sticky headers are where they belong.
      // Force every lazy image to load, then walk the page. Scrolling alone is
      // not reliable: a fast programmatic scroll past a below-fold image can
      // start its request and then abandon it on the way back to the top,
      // which photographs as an empty box even though a real reader — who
      // arrives at normal speed and stays — gets the image every time.
      await page.evaluate(async () => {
        for (const img of document.images) img.loading = "eager";
        const step = window.innerHeight;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 90));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState("networkidle");

      // networkidle is not enough on a cold dev server: /_next/image optimises
      // each source on first request, and a 700KB JPEG takes long enough that
      // the shot lands before the bytes do — photographing an empty box and
      // looking exactly like a broken layout. Wait on decode, not on the
      // network.
      // Only images that actually occupy layout. A `display:none` image never
      // loads at all, so waiting on the dev overlay's own icons — which the
      // style tag above just hid — would hang every single shot.
      await page
        .waitForFunction(
          () =>
            [...document.images]
              .filter((img) => img.getBoundingClientRect().width > 0)
              .every((img) => img.complete && img.naturalWidth > 0),
          undefined,
          { timeout: 30_000 },
        )
        .catch(() => console.warn(`    (some images never decoded on ${route})`));

      // Webfonts land after networkidle often enough to shift headline metrics.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(350);

      await page.screenshot({ path: path.join(dir, `${slug}.png`), fullPage: true });
      console.log(`  ${vp.name.padEnd(13)} ${route}`);
    }

    await context.close();
  }
}

/**
 * The objective half of the audit — the things Playwright can actually decide,
 * as opposed to the things that need a human eye.
 */
async function measure(browser: Browser, routes: string[]) {
  const problems: string[] = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.width < 768,
      isMobile: vp.width < 768,
    });
    const page = await context.newPage();

    for (const route of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);

      // Horizontal overflow. The single most common responsive failure, and
      // completely objective.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 1) problems.push(`${vp.name} ${route}: overflows by ${overflow}px`);

      // Tap targets below the codebase's own 44px rule, on touch viewports only
      // — that is where the rule applies.
      if (vp.width < 768) {
        const small = await page.evaluate(() => {
          const hits: string[] = [];
          for (const el of document.querySelectorAll("a, button, [role=button], input, select")) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue; // hidden
            // `.tap` grows the hit area with an ::after pseudo-element, which
            // getBoundingClientRect does not see. Honour it.
            if (el.classList.contains("tap")) continue;
            if (r.height < 44) {
              hits.push(`${el.tagName.toLowerCase()}"${(el.textContent ?? "").trim().slice(0, 28)}" ${Math.round(r.height)}px`);
            }
          }
          return hits;
        });
        for (const s of small.slice(0, 8)) problems.push(`${vp.name} ${route}: tap ${s}`);
      }
    }

    await context.close();
  }

  return problems;
}

async function main() {
  const label = process.argv[2] ?? "current";
  const routesArg = process.argv.find((a) => a.startsWith("--routes="));
  const routes = routesArg ? routesArg.slice("--routes=".length).split(",") : PUBLIC_ROUTES;

  const browser = await chromium.launch({ channel: "chrome" });

  // Warm-up pass. The dev server compiles routes and CSS on demand, so the
  // very first request after an edit can be served with a stylesheet that does
  // not yet contain the classes just written — which shows up here as a button
  // measuring 18px instead of 52px and sends you hunting a layout bug that does
  // not exist. Ask for each route once and throw the result away.
  const warm = await browser.newPage();
  for (const route of routes) {
    await warm.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
  }
  await warm.close();

  console.log(`\nShooting "${label}" from ${BASE}\n`);
  await shoot(browser, label, routes);

  console.log(`\nMeasuring…\n`);
  const problems = await measure(browser, routes);
  if (problems.length === 0) {
    console.log("  no overflow or tap-target failures");
  } else {
    for (const p of problems) console.log(`  ⚠ ${p}`);
  }

  await browser.close();
  console.log(`\n→ redesign/shots/${label}/\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
