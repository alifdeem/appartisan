import "server-only";

import fs from "node:fs";
import path from "node:path";

/**
 * Photograph slots.
 *
 * The photographs listed in IMAGE-PROMPTS.md do not exist yet, and `next/image`
 * hard-fails on a missing file rather than degrading. Rather than leave the
 * layout half-built until they arrive — or worse, ship placeholder stock, which
 * reads as fake instantly — every slot asks here whether its file is on disk.
 *
 * If it is, it renders. If it is not, the caller draws a hatched paper
 * placeholder at the *same aspect ratio*, so the page is already at its final
 * proportions and nothing moves when the real photograph lands. Dropping a
 * correctly-named JPEG into public/img and rebuilding is the whole handoff; no
 * code changes.
 *
 * **The answer is re-read on every access in development, and cached in
 * production.** It used to be resolved once, at module load, which made the
 * documented handoff silently untrue: dropping a photograph into `public/img`
 * did nothing until someone restarted the dev server, and the symptom — a slot
 * that still renders its placeholder next to a file that plainly exists — looks
 * exactly like a wrong path. In production the filesystem cannot change under a
 * running build, so the first answer is kept.
 */

const PUBLIC_DIR = path.join(process.cwd(), "public");
const resolved = new Map<string, string | null>();
const warned = new Set<string>();

/**
 * Is this actually a PNG, and does it actually carry an alpha channel?
 *
 * Image generators export JPEG by default and renaming the file to `.png` does
 * not change what is inside it. A JPEG cannot store transparency at all, so a
 * plate that is meant to composite over the page renders as an opaque
 * rectangle — a white box around the artisan — and nothing in the build
 * complains, because the file exists and the browser sniffs the real format and
 * displays it happily.
 *
 * That is a slow, confusing bug to find by eye, so `.png` slots are sniffed in
 * development and a wrong one says so on the server console, by name, with the
 * fix. Twelve bytes per file, once, in dev only.
 *
 * PNG colour type lives at byte 25: 4 is grey+alpha, 6 is RGBA. Anything else
 * is a PNG with no alpha channel, which is just as opaque as a JPEG.
 */
function warnIfNotTransparent(absolute: string, relativePath: string) {
  if (!relativePath.endsWith(".png") || warned.has(relativePath)) return;
  warned.add(relativePath);

  try {
    const head = Buffer.alloc(26);
    const fd = fs.openSync(absolute, "r");
    fs.readSync(fd, head, 0, 26, 0);
    fs.closeSync(fd);

    const isPng = head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!isPng) {
      const jpeg = head[0] === 0xff && head[1] === 0xd8;
      console.warn(
        `[images] public/${relativePath} is named .png but is ${jpeg ? "a JPEG" : "not a PNG"}. ` +
          `It will render as an opaque rectangle — JPEG cannot store transparency. ` +
          `Re-export it as a real PNG with a transparent background.`,
      );
      return;
    }

    const colourType = head[25];
    if (colourType !== 4 && colourType !== 6) {
      console.warn(
        `[images] public/${relativePath} is a PNG with no alpha channel (colour type ${colourType}). ` +
          `It will render as an opaque rectangle. Re-export it with transparency.`,
      );
    }
  } catch {
    // A slot that cannot be sniffed is not a slot that should break the page.
  }
}

function slot(relativePath: string): string | null {
  if (process.env.NODE_ENV === "production" && resolved.has(relativePath)) {
    return resolved.get(relativePath) ?? null;
  }

  let value: string | null = null;
  try {
    const absolute = path.join(PUBLIC_DIR, relativePath);
    if (fs.existsSync(absolute)) {
      value = `/${relativePath}`;
      if (process.env.NODE_ENV !== "production") warnIfNotTransparent(absolute, relativePath);
    }
  } catch {
    value = null;
  }

  resolved.set(relativePath, value);
  return value;
}

/**
 * Turns a map of `key -> public path` into an object whose every read calls
 * `slot`. Getters rather than plain values: a plain value is computed when the
 * module first loads, which is the behaviour above exists to avoid.
 */
function slots<K extends string>(
  paths: Record<K, string | string[]>,
): Readonly<Record<K, string | null>> {
  const out = {} as Record<K, string | null>;
  for (const key of Object.keys(paths) as K[]) {
    const candidates = paths[key];
    Object.defineProperty(out, key, {
      // A list means "first of these that exists". It is how a screen borrows
      // an image from elsewhere in the app until it has one of its own,
      // without the caller having to know that is what happened.
      get: () =>
        Array.isArray(candidates)
          ? (candidates.map(slot).find((value) => value !== null) ?? null)
          : slot(candidates),
      enumerable: true,
    });
  }
  return out;
}

export const photos = slots({
  artisanKwame: "img/artisan-kwame.jpg",
  artisanYaw: "img/artisan-yaw.jpg",
  artisanAbena: "img/artisan-abena.jpg",
  workElectrical: "img/work-electrical.jpg",
  workPlumbing: "img/work-plumbing.jpg",
  workAc: "img/work-ac.jpg",
  workCarpentry: "img/work-carpentry.jpg",
  heroWide: "img/hero-wide.jpg",

  /* ---- 2026 auth reference ------------------------------------------------
     Three slots, all PNG with real transparency — that is the whole point of
     them. The brief's architecture rule is that images are *background and
     foreground plates only*: no text, no UI, no baked-in shapes. Each of these
     composites over the coded `AuthBackdrop`, so a hard rectangular edge would
     show as a box floating on the wash. */
  authPortrait: "img/auth-artisan-portrait.png",
  authSkyline: "img/auth-skyline.png",
  authArtisanBack: "img/auth-artisan-back.png",

  /**
   * The artisan dashboard hero, right of the greeting.
   *
   * **Falls back to the login portrait**, which is the same artisan, the same
   * navy, and already a real transparent PNG — so the dashboard gets its
   * editorial hero today rather than waiting on a second shoot. Drop a
   * dedicated `provider-hero-artisan.png` in and it takes over with no code
   * change.
   *
   * Worth knowing when that bespoke one is made: unlike every photograph on the
   * client side, this one is of the *reader*. It wants a confident working
   * portrait, not a stock smile.
   */
  providerHero: ["img/provider-hero-artisan.png", "img/auth-artisan-portrait.png"],
});

/**
 * Photographs for the trade cards.
 *
 * Keyed by `categories.slug`, so the file for Electrical is
 * `public/img/category/electrical.jpg` and nothing in code needs to know it
 * arrived. Drop a correctly-named JPEG in and it appears; until then the card
 * falls back to a tinted panel carrying the trade's icon, at the same aspect
 * ratio, so nothing on the page moves when the photograph lands.
 *
 * A function rather than a fixed map, because the browse screen shows all 26
 * trades and the home screen shows six. `slot` caches in production and
 * re-stats in development, so this costs 26 `existsSync` calls per render in
 * dev and nothing at all in a build.
 */
export function categoryPhoto(slug: string): string | null {
  return slot(`img/category/${slug}.jpg`);
}

export function categoryPhotoMap(slugs: readonly string[]): Record<string, string | null> {
  return Object.fromEntries(slugs.map((slug) => [slug, categoryPhoto(slug)]));
}

/**
 * The six on the home screen's "Popular right now" row, in the order they
 * appear — the editorial decision, rather than whatever `sort_order` happens to
 * be.
 */
export const FEATURED_SLUGS = [
  "electrical",
  "plumbing",
  "cleaning",
  "ac-refrigeration",
  "carpentry",
  "painting",
] as const;
