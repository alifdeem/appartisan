import "server-only";

import { createClient } from "@/lib/supabase/server";
import { JOB_PHOTO_BUCKET, VOICE_NOTE_BUCKET } from "@/lib/jobs/media";
import { jobStatus } from "@/lib/jobs/status";
import type {
  CategoryRow,
  DisputeRow,
  JobEventRow,
  JobPhotoRow,
  JobRow,
  RatingRow,
} from "@/lib/supabase/types";

/**
 * Client-side reads for the job screens.
 *
 * Everything here goes through the session-bound client, never the service
 * role, so RLS is what decides what comes back. If a policy is wrong these
 * pages return nothing and look broken, which is the failure mode we want —
 * the alternative is a page that quietly renders somebody else's address.
 */

export type JobWithCategory = JobRow & {
  category: Pick<CategoryRow, "id" | "name" | "slug" | "icon"> | null;
};

/** Photos live in a private bucket, so they are only viewable through a signed URL. */
export interface SignedPhoto {
  id: string;
  path: string;
  /** Null when signing failed — the UI shows a placeholder rather than a broken image. */
  url: string | null;
}

/**
 * An explicit list, not `*` — the point is that adding a column to `jobs` does
 * not silently start shipping it to every screen that reads a job.
 *
 * The cost is the other half of that bargain: a new column nobody adds here is
 * simply absent, and absent reads as "the feature does not work" rather than as
 * an error. `preferred_date` / `preferred_window` were exactly that for one
 * build — written correctly by the action, never read back, so the review
 * screen said "As soon as possible" over a row that held a date.
 */
const JOB_COLUMNS =
  "id, reference, client_id, provider_id, category_id, status, description, voice_note_path, " +
  "address_text, ghanapost_code, landmark, location_lat, location_lng, matching_radius_km, " +
  "matching_pass, quote_rejections, preferred_date, preferred_window, " +
  "created_at, updated_at, closed_at";

/**
 * Signed URLs are deliberately short-lived. A job photo can show the inside of
 * somebody's home; a link that outlives the page view is a link that ends up in
 * a browser history on a shared phone.
 */
const SIGNED_URL_TTL_SECONDS = 60 * 10;

export async function listActiveCategories(): Promise<CategoryRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[jobs] listActiveCategories failed", error);
    return [];
  }

  return data ?? [];
}

/**
 * Every job belonging to the signed-in client, newest first.
 *
 * RLS scopes this to the caller, so there is no `client_id` filter here — one
 * would be redundant and would imply the policy is not trusted.
 */
export async function listClientJobs(): Promise<JobWithCategory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select(`${JOB_COLUMNS}, category:categories (id, name, slug, icon)`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[jobs] listClientJobs failed", error);
    return [];
  }

  return (data ?? []) as unknown as JobWithCategory[];
}

export async function getClientJob(jobId: string): Promise<JobWithCategory | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select(`${JOB_COLUMNS}, category:categories (id, name, slug, icon)`)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    console.error("[jobs] getClientJob failed", error);
    return null;
  }

  return (data ?? null) as unknown as JobWithCategory | null;
}

export async function listJobPhotos(jobId: string): Promise<JobPhotoRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("job_photos")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[jobs] listJobPhotos failed", error);
    return [];
  }

  return data ?? [];
}

/**
 * Sign a batch of photo paths in one round trip.
 *
 * `createSignedUrls` (plural) returns one entry per path in order, each with its
 * own error, so a single unreadable object cannot take the whole gallery down.
 */
export async function signJobPhotos(photos: JobPhotoRow[]): Promise<SignedPhoto[]> {
  if (photos.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(JOB_PHOTO_BUCKET)
    .createSignedUrls(
      photos.map((p) => p.storage_path),
      SIGNED_URL_TTL_SECONDS,
    );

  if (error || !data) {
    console.error("[jobs] signJobPhotos failed", error);
    return photos.map((p) => ({ id: p.id, path: p.storage_path, url: null }));
  }

  return photos.map((photo, index) => ({
    id: photo.id,
    path: photo.storage_path,
    url: data[index]?.signedUrl ?? null,
  }));
}

export async function signVoiceNote(path: string | null): Promise<string | null> {
  if (!path) return null;

  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(VOICE_NOTE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error("[jobs] signVoiceNote failed", error);
    return null;
  }

  return data?.signedUrl ?? null;
}

/**
 * The audit trail for one job, oldest first.
 *
 * Written only by the `log_job_status_change` trigger, so this is the
 * authoritative account of what happened and when — the thing a dispute six
 * weeks later actually turns on (PLAN.md §6).
 */
export async function listJobEvents(jobId: string): Promise<JobEventRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("job_events")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[jobs] listJobEvents failed", error);
    return [];
  }

  return data ?? [];
}

/**
 * How many photos each job carries, for the list cards.
 *
 * One query for the whole page rather than one per card: a dashboard with a
 * dozen jobs would otherwise fire a dozen round trips to render a number next
 * to an icon. RLS filters the rows, so this only ever sees the caller's own.
 */
export async function countPhotosByJob(jobIds: string[]): Promise<Record<string, number>> {
  if (jobIds.length === 0) return {};

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("job_photos")
    .select("job_id")
    .in("job_id", jobIds);

  if (error) {
    console.error("[jobs] countPhotosByJob failed", error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.job_id] = (counts[row.job_id] ?? 0) + 1;
  }
  return counts;
}

/**
 * One cover photograph per job, signed, for the history list.
 *
 * **Which photograph.** A `completion` shot if the job has one — that is the
 * artisan's proof the work was done, and the thing a client is actually looking
 * for when they scroll back to March. Otherwise the earliest photograph of any
 * stage, which in practice is the client's own picture of the problem.
 *
 * That preference deliberately does **not** depend on the job's status. It did
 * at first — "completion if finished, request otherwise" — and it returned
 * nothing at all for the commonest case in this database: a `paid` job, which
 * `jobStatus` groups as *active* rather than closed, carrying only completion
 * photographs. A rule that reads the photographs themselves cannot be wrong
 * about which ones exist.
 *
 * Two round trips for the whole page, not two per job: one select over every
 * photo belonging to the visible jobs, then one batched signing call. The
 * per-job pick happens in memory because expressing it in PostgREST would take
 * a view, and a view is a migration for something the page can decide itself.
 *
 * A job with no photographs is simply absent from the result, and the caller
 * falls back to the trade's own photograph.
 */
export async function coverPhotoByJob(jobIds: string[]): Promise<Record<string, string | null>> {
  if (jobIds.length === 0) return {};

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("job_photos")
    .select("job_id, storage_path, stage, created_at")
    .in("job_id", jobIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[jobs] coverPhotoByJob failed", error);
    return {};
  }

  // Earliest-first above, so the first write per job wins and a later
  // completion shot only displaces a non-completion one.
  const picked = new Map<string, { path: string; isCompletion: boolean }>();
  for (const row of data ?? []) {
    const isCompletion = row.stage === "completion";
    const held = picked.get(row.job_id);
    if (!held || (isCompletion && !held.isCompletion)) {
      picked.set(row.job_id, { path: row.storage_path, isCompletion });
    }
  }

  const entries = [...picked.entries()];
  if (entries.length === 0) return {};

  const { data: signed, error: signError } = await supabase.storage
    .from(JOB_PHOTO_BUCKET)
    .createSignedUrls(
      entries.map(([, value]) => value.path),
      SIGNED_URL_TTL_SECONDS,
    );

  if (signError || !signed) {
    console.error("[jobs] coverPhotoByJob signing failed", signError);
    return {};
  }

  return Object.fromEntries(
    entries.map(([jobId], index) => [jobId, signed[index]?.signedUrl ?? null]),
  );
}

/**
 * The artisan assigned to a job, as the client is allowed to see them.
 *
 * Reads `provider_public` (migration 0020), which is the whole point of that
 * view existing: `providers` itself carries the Ghana Card number, the Mobile
 * Money details and the payout recipient code, none of which a client has any
 * business reading. The view exposes a name, a rating and a job count, and only
 * for artisans who are approved and not suspended.
 *
 * Until now nothing read it. The client's job screen never named the person
 * coming to their house — which is a strange gap on a product whose pitch is
 * that the artisan is verified.
 */
export interface JobProvider {
  profileId: string;
  fullName: string;
  ratingAvg: number;
  ratingCount: number;
  jobsCompleted: number;
}

export async function getJobProvider(providerId: string | null): Promise<JobProvider | null> {
  if (!providerId) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("provider_public")
    .select("profile_id, full_name, rating_avg, rating_count, jobs_completed")
    .eq("profile_id", providerId)
    .maybeSingle();

  if (error) {
    console.error("[jobs] getJobProvider failed", error);
    return null;
  }
  if (!data) return null;

  return {
    profileId: data.profile_id,
    fullName: data.full_name,
    ratingAvg: Number(data.rating_avg),
    ratingCount: Number(data.rating_count),
    jobsCompleted: Number(data.jobs_completed),
  };
}

/**
 * Counts for the dashboard tiles, derived in one pass over the job list.
 *
 * Grouping is delegated to `jobStatus()` rather than restated here. Keeping a
 * second list of "which statuses count as active" is how a tile ends up saying
 * two while the list underneath it shows three — `paid`, for instance, reads as
 * finished but is still active until the client rates it and it closes.
 */
export function summariseJobs(jobs: JobWithCategory[]) {
  let drafts = 0;
  let active = 0;
  let completed = 0;

  for (const job of jobs) {
    const group = jobStatus(job.status).group;
    if (group === "draft") drafts += 1;
    else if (group === "active") active += 1;
    // `closed` covers cancellations and no-match as well as finished work, so
    // only a job that actually completed is counted.
    else if (job.status === "closed") completed += 1;
  }

  return { drafts, active, completed, total: jobs.length };
}

/* -------------------------------------------------------------------------
 * Phase 6 — rating and dispute for one job
 * ---------------------------------------------------------------------- */

/**
 * The client's own rating of a job, if they have left one.
 *
 * `ratings.job_id` is the primary key, so this is at most one row. Read under
 * RLS like everything else — the public-read policy on ratings is deliberate
 * (a rating is reputation, and reputation is public), but the job screen only
 * ever asks about its own job.
 */
export async function getJobRating(jobId: string): Promise<RatingRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ratings")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) {
    console.error("[jobs] getJobRating failed:", error.message);
    return null;
  }

  return (data as RatingRow | null) ?? null;
}

/**
 * The most recent dispute on a job. `raise_dispute` refuses a second open one,
 * so at most one is ever live; older resolved ones are kept for the record.
 */
export async function getJobDispute(jobId: string): Promise<DisputeRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("disputes")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[jobs] getJobDispute failed:", error.message);
    return null;
  }

  return (data as DisputeRow | null) ?? null;
}

/* -------------------------------------------------------------------------
 * The other party on a job
 * ---------------------------------------------------------------------- */

/**
 * The person on the other end of a job — their name and their phone number.
 *
 * Backed by a policy that has been in the schema since the very first RLS
 * migration and had never been used by anything:
 *
 *   -- Counterparties on a shared job can see each other's name and phone.
 *   -- Without this the client cannot call the artisan who is on the way to
 *   -- their house.
 *   create policy "profiles: read job counterparty" ...   (0003_rls.sql:74)
 *
 * The comment names the exact gap it was written to close, and the gap was
 * still open: neither job screen had a phone number on it, so a client whose
 * artisan was late had nothing to do about it, and an artisan who could not
 * find a blue gate had nobody to ask. In Ghana that call **is** the product.
 *
 * Read from `profiles` rather than from `provider_public`, because the view
 * deliberately omits the phone number — it exists to expose an artisan to
 * *everyone*, and this is the much narrower case of exposing two specific
 * people to each other. `provider_public` stays the right source for the
 * rating and the job count, which is why `getJobProvider` is unchanged and
 * this is a second, separate read.
 *
 * Returns null rather than throwing when the policy denies the row. That is
 * the normal case, not an error: an unassigned job has no counterparty, and a
 * caller passing a stale id should get a screen without a call button, not a
 * crash.
 */
export interface JobCounterparty {
  id: string;
  fullName: string;
  phone: string;
}

export async function getJobCounterparty(
  personId: string | null,
): Promise<JobCounterparty | null> {
  if (!personId) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .eq("id", personId)
    .maybeSingle();

  if (error) {
    console.error("[jobs] getJobCounterparty failed", error);
    return null;
  }
  if (!data) return null;

  return { id: data.id, fullName: data.full_name, phone: data.phone };
}
