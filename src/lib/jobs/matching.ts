import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { JobWithCategory } from "@/lib/jobs/queries";
import type {
  CategoryRow,
  JobOfferRow,
  JobRow,
  ProfileRow,
  QuoteItemRow,
  QuoteRow,
} from "@/lib/supabase/types";

/**
 * Reads for the matcher and the quote.
 *
 * Session-bound throughout, so RLS decides visibility. That matters most on the
 * offer screen: an artisan is shown a client's home address and photographs of
 * the inside of it *before* accepting, which is necessary — you cannot price a
 * job you cannot see — and is only acceptable because the policy scopes it to
 * the artisan holding a live offer on that specific job.
 */

const JOB_COLUMNS =
  "id, reference, client_id, provider_id, category_id, status, description, voice_note_path, " +
  "address_text, ghanapost_code, landmark, location_lat, location_lng, matching_radius_km, " +
  "matching_pass, quote_rejections, created_at, updated_at, closed_at";

export type OfferWithJob = JobOfferRow & {
  job: (JobRow & { category: Pick<CategoryRow, "id" | "name" | "slug" | "icon"> | null }) | null;
};

export interface MatchingProgress {
  contacted: number;
  currentPass: number;
  radiusKm: number;
  /** When the artisan currently holding it runs out of time. Null if nobody is. */
  offerExpiresAt: string | null;
}

/**
 * The artisan's live offer, if they have one.
 *
 * Expiry is filtered on the clock rather than on `status`, because the sweep
 * runs every 30 seconds and the gap between an offer lapsing and being marked
 * `expired` is exactly the window in which showing it would be a lie.
 */
export async function getLiveOffer(): Promise<OfferWithJob | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("job_offers")
    .select(`*, job:jobs (${JOB_COLUMNS}, category:categories (id, name, slug, icon))`)
    .eq("provider_id", user.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[matching] getLiveOffer failed:", error.message, error.details ?? "");
    return null;
  }

  return (data ?? null) as unknown as OfferWithJob | null;
}

export async function getOffer(offerId: string): Promise<OfferWithJob | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("job_offers")
    .select(`*, job:jobs (${JOB_COLUMNS}, category:categories (id, name, slug, icon))`)
    .eq("id", offerId)
    .maybeSingle();

  if (error) {
    console.error("[matching] getOffer failed:", error.message, error.details ?? "");
    return null;
  }

  return (data ?? null) as unknown as OfferWithJob | null;
}

/** The job an artisan is currently working, at any stage past acceptance. */
export async function getAssignedJob(jobId: string): Promise<JobWithCategory | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select(`${JOB_COLUMNS}, category:categories (id, name, slug, icon)`)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    console.error("[matching] getAssignedJob failed:", error.message, error.details ?? "");
    return null;
  }

  return (data ?? null) as unknown as JobWithCategory | null;
}

export async function listProviderJobs(): Promise<JobWithCategory[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("jobs")
    .select(`${JOB_COLUMNS}, category:categories (id, name, slug, icon)`)
    .eq("provider_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[matching] listProviderJobs failed:", error.message, error.details ?? "");
    return [];
  }

  return (data ?? []) as unknown as JobWithCategory[];
}

/**
 * How the search is going, for the client's "we've contacted N so far".
 *
 * Through the RPC rather than by counting `job_offers` directly: those rows
 * carry provider ids, and a client watching their own job has no business
 * learning which artisans turned it down.
 */
export async function getMatchingProgress(jobId: string): Promise<MatchingProgress | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("job_matching_progress", { p_job_id: jobId });

  if (error) {
    console.error("[matching] getMatchingProgress failed:", error.message, error.details ?? "");
    return null;
  }

  const row = data?.[0];
  if (!row) return null;

  return {
    contacted: row.contacted,
    currentPass: row.current_pass,
    radiusKm: Number(row.radius_km),
    offerExpiresAt: row.offer_expires_at,
  };
}

export interface QuoteContext {
  distanceKm: number | null;
  /** Set by the admin's band table, not by the artisan. Passes to them in full. */
  transportFee: number;
  commissionPct: number;
}

/**
 * The two numbers the artisan does not control, resolved before they start
 * typing.
 *
 * The builder needs both to show a live client-facing total, and that total is
 * the whole point of the screen — PLAN.md §4 warns that an artisan who thinks
 * the job is GHS 400 while the client is paying GHS 448 will have that
 * conversation on the customer's doorstep, and it will go badly.
 *
 * These are for *display*. `save_quote` recomputes both from the same sources
 * when the quote is stored, so a tampered page can mislead the artisan about
 * their own preview and cannot change what anybody is charged.
 */
export async function getQuoteContext(jobId: string): Promise<QuoteContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: offer }, { data: setting }, { data: provider }] = await Promise.all([
    supabase
      .from("job_offers")
      .select("distance_km")
      .eq("job_id", jobId)
      .eq("status", "accepted")
      .order("responded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("settings").select("value").eq("key", "platform_commission_pct").maybeSingle(),
    user
      ? supabase.from("providers").select("base_city").eq("profile_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const distanceKm = offer?.distance_km === null || offer?.distance_km === undefined
    ? null
    : Number(offer.distance_km);

  const { data: fee } = await supabase.rpc("transport_fee_for_distance", {
    p_city: provider?.base_city ?? "*",
    p_distance_km: distanceKm ?? 0,
  });

  return {
    distanceKm,
    transportFee: Number(fee ?? 0),
    commissionPct: Number(setting?.value ?? 12),
  };
}

export type QuoteWithItems = QuoteRow & { items: QuoteItemRow[] };

/**
 * The quote on a job, newest first.
 *
 * A job can accumulate several across rematches — a rejected quote is kept, not
 * deleted, because "they quoted me 900 last time" is a question somebody asks
 * later and the rejected row is the only answer.
 */
export async function getLatestQuote(jobId: string): Promise<QuoteWithItems | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotes")
    .select("*, items:quote_items (*)")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[matching] getLatestQuote failed:", error.message, error.details ?? "");
    return null;
  }

  if (!data) return null;

  const quote = data as unknown as QuoteWithItems;
  quote.items = [...(quote.items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  return quote;
}

export type UnmatchedJob = JobWithCategory & {
  client: Pick<ProfileRow, "id" | "full_name" | "phone"> | null;
};

/**
 * The admin fallback queue.
 *
 * PLAN.md §6 is blunt that every real marketplace runs on a human phoning an
 * artisan for its first six months, so this is a first-class screen rather than
 * an error log. Ordered oldest-first — it is a queue somebody is waiting in.
 */
export async function listUnmatchedJobs(): Promise<UnmatchedJob[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select(`${JOB_COLUMNS}, category:categories (id, name, slug, icon)`)
    .in("status", ["unmatched", "expired_no_match"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[matching] listUnmatchedJobs failed:", error.message, error.details ?? "");
    return [];
  }

  const jobs = (data ?? []) as unknown as JobWithCategory[];
  if (jobs.length === 0) return [];

  /**
   * The client's name and number come from a second query rather than an
   * embed, because `jobs.client_id` references `clients`, not `profiles` — so
   * the obvious `client:profiles!jobs_client_id_fkey(...)` hint does not exist
   * and PostgREST answers PGRST200. Reaching `profiles` through `clients` would
   * work and would couple this screen to a two-hop constraint chain for two
   * strings.
   *
   * One extra round trip on a queue that is a handful of rows by construction.
   * If this queue is ever long enough for that to matter, the problem is supply.
   */
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", [...new Set(jobs.map((job) => job.client_id))]);

  if (profileError) {
    // The queue is still usable without the phone numbers — an admin can open
    // a job and call from there — so this degrades rather than returning none.
    console.error("[matching] unmatched clients failed:", profileError.message);
  }

  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return jobs.map((job) => ({ ...job, client: byId.get(job.client_id) ?? null }));
}

/** Approved artisans in a category, for the admin's manual assignment picker. */
export async function listAssignableProviders(categoryId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("provider_categories")
    .select(
      "provider:providers!inner (profile_id, availability, base_city, rating_avg, rating_count, " +
        "jobs_completed, verification_status, profile:profiles (id, full_name, phone))",
    )
    .eq("category_id", categoryId)
    .eq("provider.verification_status", "approved");

  if (error) {
    console.error("[matching] listAssignableProviders failed:", error.message, error.details ?? "");
    return [];
  }

  return (data ?? [])
    .map((row) => (row as unknown as { provider: AssignableProvider | null }).provider)
    .filter((provider): provider is AssignableProvider => provider !== null);
}

export interface AssignableProvider {
  profile_id: string;
  availability: string;
  base_city: string | null;
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
  verification_status: string;
  profile: Pick<ProfileRow, "id" | "full_name" | "phone"> | null;
}
