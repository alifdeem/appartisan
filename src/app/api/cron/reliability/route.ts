import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { reportError } from "@/lib/integrations/monitoring";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The reliability sweep.
 *
 * Runs `apply_reliability_scoring()` (migration 0018), which scores every
 * approved artisan against the thresholds in `settings` and suspends the ones
 * past the line — into an admin's queue, never out of the platform. PLAN.md §8
 * is explicit that suspension is "never automatic-permanent": it removes them
 * from matching and puts them in front of a human who calls them.
 *
 * Daily rather than by the minute, unlike the offer sweep. The window is 30
 * days rolling, so nothing changes between one hour and the next, and a sweep
 * that suspends people is the last thing that should run on a hair trigger.
 *
 * Auth is the same bearer token the other crons use, and mandatory in
 * production for a stronger reason than theirs: an open endpoint here is a way
 * to suspend a competitor's artisans.
 */

export const dynamic = "force-dynamic";

function authorised(request: Request): boolean {
  const secret = env.CRON_SECRET;

  if (!secret) {
    return env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function sweep() {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("apply_reliability_scoring");

  if (error) {
    console.error("[cron:reliability] sweep failed", error);
    await reportError(error, { scope: "cron:reliability" });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if ((data ?? 0) > 0) {
    // Worth a log line: somebody's income just stopped, and the admin queue is
    // the only other place that becomes visible.
    console.warn(`[cron:reliability] auto-suspended ${data} artisan(s)`);
  }

  return NextResponse.json({ ok: true, suspended: data ?? 0 });
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return sweep();
}

/** GET as well as POST — Vercel Cron issues a GET. Same guard either way. */
export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return sweep();
}
