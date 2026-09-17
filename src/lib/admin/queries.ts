import "server-only";

import { JOB_PHOTO_BUCKET } from "@/lib/jobs/media";
import { createClient } from "@/lib/supabase/server";
import type {
  DisputeRow,
  JobRow,
  ProfileRow,
  ReliabilityVerdict,
  SettingRow,
} from "@/lib/supabase/types";

/**
 * Admin reads for Phase 6.
 *
 * Everything here runs through the anon client under the admin's own session,
 * not the service role. The `is_admin()` policies in 0003 and 0018 are what
 * make these return anything at all — so if a policy is wrong this page breaks
 * loudly instead of quietly working for the wrong person.
 */

export type DisputeWithContext = DisputeRow & {
  job: Pick<JobRow, "id" | "reference" | "status"> | null;
  raiser: Pick<ProfileRow, "full_name" | "phone" | "role"> | null;
  /** Signed for the admin's session only. Null where signing failed. */
  evidence: { path: string; url: string | null }[];
};

/** Long enough to read a queue and open a photo; short enough not to be a link. */
const SIGNED_URL_TTL_SECONDS = 60 * 10;

/** Open disputes first, oldest first within that — a queue, not a feed. */
export async function listDisputes(): Promise<DisputeWithContext[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("disputes")
    .select(
      "*, job:jobs (id, reference, status), raiser:profiles!disputes_raised_by_fkey (full_name, phone, role)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin] listDisputes failed:", error.message, error.details ?? "");
    return [];
  }

  const rows = (data ?? []) as unknown as DisputeWithContext[];

  // Evidence lives in the private job-photos bucket, so an admin needs a signed
  // URL per object. Signed in one batch across every dispute rather than per
  // row — a queue of twenty disputes should not be twenty round trips.
  const allPaths = rows.flatMap((row) => row.evidence_paths);

  if (allPaths.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from(JOB_PHOTO_BUCKET)
      .createSignedUrls(allPaths, SIGNED_URL_TTL_SECONDS);

    if (signError) console.error("[admin] signing dispute evidence failed:", signError.message);

    const byPath = new Map(
      (signed ?? []).map((entry, index) => [allPaths[index], entry?.signedUrl ?? null]),
    );

    for (const row of rows) {
      row.evidence = row.evidence_paths.map((path) => ({ path, url: byPath.get(path) ?? null }));
    }
  } else {
    for (const row of rows) row.evidence = [];
  }

  const rank = (status: DisputeRow["status"]) =>
    status === "open" ? 0 : status === "investigating" ? 1 : 2;

  return rows.sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export async function listSettings(): Promise<SettingRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("settings").select("*").order("key");

  if (error) {
    console.error("[admin] listSettings failed:", error.message);
    return [];
  }

  return (data ?? []) as SettingRow[];
}

export interface FlaggedProvider {
  providerId: string;
  name: string;
  phone: string;
  verdict: ReliabilityVerdict;
}

/**
 * Artisans the reliability rules have something to say about.
 *
 * The verdict is computed per artisan rather than reimplemented as one big
 * query, because `reliability_verdict` reads the thresholds from `settings`
 * and applies them in a single place — duplicating that logic in SQL here is
 * how the admin console and the nightly sweep end up disagreeing about who is
 * in trouble.
 *
 * Fine at pilot scale (tens of artisans). If this list ever gets long it wants
 * a materialised view, not a faster loop.
 */
export async function listFlaggedProviders(): Promise<FlaggedProvider[]> {
  const supabase = await createClient();

  const { data: providers, error } = await supabase
    .from("providers")
    .select("profile_id, profiles!inner (full_name, phone)")
    .eq("verification_status", "approved");

  if (error) {
    console.error("[admin] listFlaggedProviders failed:", error.message);
    return [];
  }

  const rows = (providers ?? []) as unknown as {
    profile_id: string;
    profiles: { full_name: string; phone: string };
  }[];

  const flagged: FlaggedProvider[] = [];

  for (const row of rows) {
    const { data: verdict } = await supabase.rpc("reliability_verdict", {
      p_provider_id: row.profile_id,
    });

    if (verdict && verdict.action !== "ok") {
      flagged.push({
        providerId: row.profile_id,
        name: row.profiles.full_name,
        phone: row.profiles.phone,
        verdict,
      });
    }
  }

  const rank = (action: ReliabilityVerdict["action"]) =>
    action === "suspend" ? 0 : action === "review" ? 1 : 2;

  return flagged.sort((a, b) => rank(a.verdict.action) - rank(b.verdict.action));
}
