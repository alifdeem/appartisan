import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { reportError } from "@/lib/integrations/monitoring";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The offer sweep, over HTTP.
 *
 * Migration 0011 schedules `expire_stale_offers()` with pg_cron where the
 * extension is available. It is not available on every Supabase plan, and it
 * cannot always be created from a migration — so this route calls the same
 * function, and a platform cron (Vercel, GitHub Actions, or a phone with a
 * cron app) can drive it instead. Nothing here is a second implementation:
 * both paths run the identical SQL.
 *
 * Why the sweep matters at all: an offer is 120 seconds of one artisan's
 * attention. When it lapses, the job is sitting in `offer_sent` with nobody
 * looking at it, and the client is watching a spinner. Something has to notice.
 *
 * Auth is a bearer token rather than a signature: unlike the payment webhook
 * there is no third party with a shared HMAC secret, and the endpoint takes no
 * body to sign. In production the secret is mandatory — an open endpoint that
 * advances every stalled job in the system is a denial-of-service lever and a
 * way to burn a job's candidate list.
 */

export const dynamic = "force-dynamic";

function authorised(request: Request): boolean {
  const secret = env.CRON_SECRET;

  if (!secret) {
    // Locally this is a convenience; in production it is a refusal. Failing
    // closed is the only safe default for an endpoint that mutates every job.
    return env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function sweep() {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("expire_stale_offers");

  if (error) {
    console.error("[cron:matching] sweep failed", error);
    await reportError(error, { scope: "cron:matching" });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expired: data ?? 0 });
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return sweep();
}

/**
 * GET as well as POST: Vercel Cron issues a GET, and most of the simple
 * schedulers a small operator reaches for do too. Same guard either way.
 */
export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return sweep();
}
