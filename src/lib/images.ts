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
 * The check runs at build time for static pages, which is every page that uses
 * it, so there is no per-request filesystem cost.
 */

const PUBLIC_DIR = path.join(process.cwd(), "public");

function slot(relativePath: string): string | null {
  try {
    return fs.existsSync(path.join(PUBLIC_DIR, relativePath)) ? `/${relativePath}` : null;
  } catch {
    return null;
  }
}

export const photos = {
  artisanKwame: slot("img/artisan-kwame.jpg"),
  artisanYaw: slot("img/artisan-yaw.jpg"),
  artisanAbena: slot("img/artisan-abena.jpg"),
  workElectrical: slot("img/work-electrical.jpg"),
  workPlumbing: slot("img/work-plumbing.jpg"),
  workAc: slot("img/work-ac.jpg"),
  workCarpentry: slot("img/work-carpentry.jpg"),
  heroWide: slot("img/hero-wide.jpg"),
} as const;
