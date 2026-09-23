/**
 * Side-by-side rig for matching a coded screen to a mockup.
 *
 * Two jobs, both of which were being done badly by hand before this existed:
 *
 *   `crop`  — pull a band out of a mockup PNG at full resolution, so a section
 *             can actually be read rather than squinted at in a thumbnail.
 *             `sips` crops from the centre and silently returns black when an
 *             offset lands out of bounds, which is how the first three attempts
 *             at this produced an empty image.
 *
 *   `shoot` — screenshot a live route at a phone width, full page, signed in as
 *             whoever the caller names.
 *
 * Usage:
 *   npx tsx scripts/compare-shot.ts crop  <file.png> <y> <h> [out.png]
 *   npx tsx scripts/compare-shot.ts shoot <path> <userId> [out.png] [width]
 */

import { config } from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { pathToFileURL } from "node:url";

config({ path: ".env.local" });

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Drive the installed Google Chrome rather than Playwright's own Chromium.
 *
 * This machine is macOS 12, and current Playwright refuses to install a
 * Chromium build for it — `npx playwright install chromium` fails outright with
 * "does not support chromium on mac12". Every browser script in here is dead on
 * this Mac without the channel, including `npm run shots`.
 */
const LAUNCH = { channel: "chrome" } as const;

async function crop(file: string, y: number, h: number, out: string) {
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

  const url = pathToFileURL(path.resolve(file)).href;
  /**
   * Navigate straight to the file rather than `setContent` with an `<img>`
   * pointing at it: Chrome refuses to load a `file://` subresource into an
   * `about:blank` document, which returns a 1200x16 box and a blank crop. A
   * browser renders an image URL as a standalone document, so the image is the
   * document and the clip below is in its own pixels.
   */
  await page.goto(url, { waitUntil: "load" });

  /**
   * Chrome renders a bare image URL in its own viewer, which **shrinks the
   * image to fit the viewport** — at a 1200x900 window an 887x1774 mockup came
   * back as 450x900 and every crop was measured against the wrong scale. So
   * read the natural size and make the viewport exactly that, which turns
   * shrink-to-fit off and puts the document at 1:1.
   */
  const natural = await page.evaluate(() => {
    const img = document.querySelector("img");
    return img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
  });
  if (!natural || natural.w < 50) throw new Error("image did not load");

  await page.setViewportSize({ width: natural.w, height: natural.h });
  await page.addStyleTag({
    content: "html,body{margin:0;padding:0;background:#fff}img{display:block;width:auto;height:auto;max-width:none}",
  });

  const clipHeight = Math.min(h, natural.h - y);
  await page.screenshot({ path: out, clip: { x: 0, y, width: natural.w, height: clipHeight } });

  console.log(`cropped ${file} y=${y} h=${clipHeight} -> ${out}  (source ${natural.w}x${natural.h})`);
  await browser.close();
}

/**
 * The same synthetic-email session the a11y and smoke scripts use. Signing in
 * through the UI would burn an OTP and a rate-limit slot on every screenshot.
 */
async function sessionCookie(userId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: user } = await admin.auth.admin.getUserById(userId);
  if (!user.user?.email) throw new Error(`no user ${userId}`);

  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.user.email,
  });
  const auth = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await auth.auth.verifyOtp({
    type: "magiclink",
    token_hash: link!.properties!.hashed_token!,
  });

  const ref = new URL(url).hostname.split(".")[0];
  return {
    name: `sb-${ref}-auth-token`,
    value: `base64-${Buffer.from(JSON.stringify(data.session)).toString("base64")}`,
    domain: new URL(ORIGIN).hostname,
    path: "/",
  };
}

async function shoot(route: string, userId: string, out: string, width: number) {
  const browser = await chromium.launch(LAUNCH);
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2,
  });

  await context.addCookies([await sessionCookie(userId)]);

  const page = await context.newPage();
  await page.goto(`${ORIGIN}${route}`, { waitUntil: "networkidle" });

  // The dev panel is a fixed overlay that sits on top of the bottom of every
  // screen. It is not part of the design and it is not in production.
  await page.addStyleTag({
    content: `[data-dev-panel], .fixed.bottom-24,
               nextjs-portal, [data-nextjs-dev-tools-button],
               #__next-build-watcher { display: none !important; }`,
  });
  await page.waitForTimeout(600);

  /**
   * Resize the viewport to the whole page and take a normal screenshot, rather
   * than `fullPage: true`.
   *
   * Chrome's full-page capture stitches several viewport-sized shots together,
   * and anything using `backdrop-filter` or `position: fixed` — this app's
   * floating nav does both — composites differently in each slice. The first
   * run of this produced a dashboard whose navy earnings banner appeared to
   * have lost its background entirely; the banner was fine, the screenshot was
   * not. One tall viewport paints once and cannot smear.
   */
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.min(height, 6000) });
  await page.waitForTimeout(400);

  await page.screenshot({ path: out });
  console.log(`shot ${route} at ${width}px -> ${out}  (page height ${height})`);

  await browser.close();
}

// Wrapped rather than top-level `await`: tsx compiles these scripts to CJS,
// where top-level await is a syntax error — the same trip-up the other scripts
// in here avoid the same way.
async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === "crop") {
    const [file, y, h, out = "crop.png"] = rest;
    await crop(file, Number(y), Number(h), out);
  } else if (cmd === "shoot") {
    const [route, userId, out = "shot.png", width = "390"] = rest;
    await shoot(route, userId, out, Number(width));
  } else {
    console.error("usage: crop <file> <y> <h> [out] | shoot <route> <userId> [out] [width]");
    process.exit(1);
  }
}

main();
