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

const JOB_COLUMNS =
  "id, reference, client_id, provider_id, category_id, status, description, voice_note_path, " +
  "address_text, ghanapost_code, landmark, location_lat, location_lng, matching_radius_km, " +
  "matching_pass, quote_rejections, created_at, updated_at, closed_at";

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
