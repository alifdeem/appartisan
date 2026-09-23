import "server-only";

import { PROVIDER_DOC_BUCKET } from "@/lib/providers/documents";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type {
  CategoryRow,
  ProfileRow,
  ProviderDocumentRow,
  ProviderRow,
  PayoutRow,
  ReliabilityStats,
  VerificationReviewRow,
} from "@/lib/supabase/types";

/**
 * Reads for the provider application and the admin verification queue.
 *
 * Everything here goes through the session-bound client, never the service
 * role, so RLS decides what comes back. On the admin screens that matters more
 * than usual: these queries return Ghana Card images, and the only thing
 * standing between a client session and somebody's identity documents is a
 * policy. If a policy is wrong these pages render empty, which is the failure
 * mode we want.
 */

/**
 * Identity documents are the most sensitive objects in the system, so their
 * links live half as long as a job photo's. An admin reviews an application in
 * a couple of minutes; a five-minute URL is generous for that and still short
 * enough that a copied link is useless by the time it is pasted anywhere.
 */
const DOC_URL_TTL_SECONDS = 60 * 5;

export type ProviderWithProfile = ProviderRow & {
  profile: Pick<ProfileRow, "id" | "full_name" | "phone" | "avatar_url" | "spoken_languages"> | null;
};

export interface SignedDocument extends ProviderDocumentRow {
  /** Null when signing failed — the UI shows the failure rather than a broken image. */
  url: string | null;
}

const PROVIDER_COLUMNS =
  "profile_id, bio, years_experience, verification_status, availability, service_radius_km, " +
  "base_city, momo_number, momo_network, ghana_card_number, application_submitted_at, " +
  "rating_avg, rating_count, jobs_completed, suspended_at, suspension_reason, " +
  "last_location_at, payout_recipient_code, created_at, updated_at";

const PROFILE_JOIN = "profile:profiles (id, full_name, phone, avatar_url, spoken_languages)";

/** The signed-in artisan's own row. Null if this account is not an artisan. */
export async function getMyProvider(): Promise<ProviderRow | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("providers")
    .select(PROVIDER_COLUMNS)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[providers] getMyProvider failed", error);
    return null;
  }

  return (data ?? null) as unknown as ProviderRow | null;
}

export async function listProviderCategoryIds(providerId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("provider_categories")
    .select("category_id")
    .eq("provider_id", providerId);

  if (error) {
    console.error("[providers] listProviderCategoryIds failed", error);
    return [];
  }

  return (data ?? []).map((row) => row.category_id);
}

/**
 * The artisan's trades, as categories rather than ids.
 *
 * Joined rather than fetched separately because every screen that shows the
 * trades shows their names, and two round trips to render one line of text is
 * two round trips on a connection that cannot spare them.
 */
export async function listProviderCategories(providerId: string): Promise<CategoryRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("provider_categories")
    .select("category:categories (*)")
    .eq("provider_id", providerId);

  if (error) {
    console.error("[providers] listProviderCategories failed", error);
    return [];
  }

  return ((data ?? []) as unknown as { category: CategoryRow | null }[])
    .map((row) => row.category)
    .filter((category): category is CategoryRow => category !== null)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function listProviderDocuments(providerId: string): Promise<ProviderDocumentRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("provider_documents")
    .select("*")
    .eq("provider_id", providerId)
    .order("uploaded_at", { ascending: true });

  if (error) {
    console.error("[providers] listProviderDocuments failed", error);
    return [];
  }

  return data ?? [];
}

/**
 * Sign a batch of document paths in one round trip.
 *
 * `createSignedUrls` returns one entry per path in order, each with its own
 * error, so one unreadable object cannot take the whole review screen down —
 * an admin should still be able to approve on the strength of the other two.
 */
export async function signProviderDocuments(
  docs: ProviderDocumentRow[],
): Promise<SignedDocument[]> {
  if (docs.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(PROVIDER_DOC_BUCKET)
    .createSignedUrls(
      docs.map((doc) => doc.storage_path),
      DOC_URL_TTL_SECONDS,
    );

  if (error || !data) {
    console.error("[providers] signProviderDocuments failed", error);
    return docs.map((doc) => ({ ...doc, url: null }));
  }

  return docs.map((doc, index) => ({ ...doc, url: data[index]?.signedUrl ?? null }));
}

/**
 * What is still missing, straight from the database.
 *
 * The review step calls this rather than deriving it locally, so the sentence
 * the artisan reads is produced by the same function that will refuse the
 * submission. A checklist that disagrees with the gate is worse than no
 * checklist.
 */
export async function getApplicationGaps(providerId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("provider_application_gaps", {
    p_provider_id: providerId,
  });

  if (error) {
    console.error("[providers] getApplicationGaps failed", error);
    // Fail closed. Claiming an application is ready when we could not check is
    // how somebody gets a submission error on the last screen.
    return ["We could not check your application just now. Try again in a moment."];
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/**
 * The verification queue.
 *
 * Ordered oldest-submission-first, which is the only fair order for a queue
 * somebody is waiting in — and the opposite of the newest-first default every
 * other list in this app uses. An artisan who applied on Monday should not be
 * behind one who applied this morning because the list was easier to write that
 * way.
 */
export async function listVerificationQueue(
  status: "pending" | "approved" | "rejected" | "suspended" | "unsubmitted",
): Promise<ProviderWithProfile[]> {
  const supabase = await createClient();

  const query = supabase
    .from("providers")
    .select(`${PROVIDER_COLUMNS}, ${PROFILE_JOIN}`)
    .eq("verification_status", status);

  // Everything else is most-recently-touched first; only the waiting queue is
  // a queue.
  const { data, error } =
    status === "pending"
      ? await query.order("application_submitted_at", { ascending: true })
      : await query.order("updated_at", { ascending: false });

  if (error) {
    console.error("[providers] listVerificationQueue failed", error);
    return [];
  }

  return (data ?? []) as unknown as ProviderWithProfile[];
}

/** Counts for the queue's filter tabs, in one pass rather than one query per tab. */
export async function countByVerificationStatus(): Promise<Record<string, number>> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("providers").select("verification_status");

  if (error) {
    console.error("[providers] countByVerificationStatus failed", error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.verification_status] = (counts[row.verification_status] ?? 0) + 1;
  }
  return counts;
}

export async function getProviderForReview(providerId: string): Promise<ProviderWithProfile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("providers")
    .select(`${PROVIDER_COLUMNS}, ${PROFILE_JOIN}`)
    .eq("profile_id", providerId)
    .maybeSingle();

  if (error) {
    console.error("[providers] getProviderForReview failed", error);
    return null;
  }

  return (data ?? null) as unknown as ProviderWithProfile | null;
}

export type ReviewWithAdmin = VerificationReviewRow & {
  admin: Pick<ProfileRow, "id" | "full_name"> | null;
};

/**
 * Every decision ever taken on this artisan, newest first.
 *
 * Shown to the admin *and* to the artisan themselves. Hiding the reason you
 * were turned down, and then expecting you to fix it, is how a supply-side
 * marketplace loses the people it needs most (PLAN.md §8 makes the same
 * argument about reliability scores).
 */
export async function listVerificationReviews(providerId: string): Promise<ReviewWithAdmin[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("verification_reviews")
    .select("*, admin:profiles!verification_reviews_admin_id_fkey (id, full_name)")
    .eq("provider_id", providerId)
    .order("reviewed_at", { ascending: false });

  if (error) {
    console.error("[providers] listVerificationReviews failed", error);
    return [];
  }

  return (data ?? []) as unknown as ReviewWithAdmin[];
}

/**
 * The signed-in artisan's own reliability record.
 *
 * `provider_reliability` refuses a caller who is neither the artisan nor an
 * admin, so this needs no ownership check of its own — the rule lives in one
 * place and holds for every caller (PLAN.md §8).
 */
export async function getMyReliability(): Promise<ReliabilityStats | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("provider_reliability", {
    p_provider_id: profile.id,
  });

  if (error) {
    console.error("[providers] getMyReliability failed:", error.message);
    return null;
  }

  return data as ReliabilityStats;
}

/* -------------------------------------------------------------------------
 * Earnings
 * ---------------------------------------------------------------------- */

export type PayoutWithJob = PayoutRow & {
  job: { id: string; reference: string; category: { name: string; icon: string } | null } | null;
};

export interface EarningsSummary {
  /** Settled money, this calendar week (Monday–Sunday, Ghana time). */
  thisWeek: number;
  /** Settled money, all time. */
  allTime: number;
  /** Raised but not yet settled — `pending` and `processing`. */
  onTheWay: number;
  /** Payouts the provider needs to know went wrong. */
  failed: number;
  settledCount: number;
}

/**
 * Every payout belonging to the signed-in artisan, newest first.
 *
 * RLS (`payouts: provider reads own`, migration 0003) scopes this, so there is
 * no `provider_id` filter — adding one would imply the policy is not trusted.
 *
 * **Payouts are read-only to artisans and this is the only reader.** Rows are
 * written by the payment adapter and by nothing in the UI, which is what lets
 * this screen be an account of money that moved rather than a view a user can
 * argue with.
 */
export async function listMyPayouts(limit = 50): Promise<PayoutWithJob[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payouts")
    .select(
      "id, job_id, provider_id, amount, currency, status, transfer_reference, is_simulated, " +
        "failure_reason, initiated_at, settled_at, " +
        "job:jobs (id, reference, category:categories (name, icon))",
    )
    .order("initiated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[providers] listMyPayouts failed", error);
    return [];
  }

  return (data ?? []) as unknown as PayoutWithJob[];
}

/**
 * The four numbers the earnings screen leads with.
 *
 * Derived from the rows already fetched rather than from four `count` queries:
 * an artisan's payout history is tens of rows, not thousands, and one pass over
 * an array beats four round trips to Accra.
 *
 * **Only `paid` counts as earned.** A `pending` or `processing` payout is money
 * the platform has raised but the network has not settled, and putting it in
 * the headline figure would mean the number drops when a transfer fails — the
 * single worst thing an earnings screen can do to someone's trust. It is shown,
 * separately and honestly, as "on the way".
 */
export function summarisePayouts(payouts: PayoutWithJob[]): EarningsSummary {
  // Monday 00:00 of the current week. Ghana is UTC+0 with no DST, so the
  // calendar day never disagrees with the UTC day.
  const now = new Date();
  const monday = new Date(now);
  const weekday = (now.getUTCDay() + 6) % 7; // Monday = 0
  monday.setUTCDate(now.getUTCDate() - weekday);
  monday.setUTCHours(0, 0, 0, 0);

  let thisWeek = 0;
  let allTime = 0;
  let onTheWay = 0;
  let failed = 0;
  let settledCount = 0;

  for (const payout of payouts) {
    const amount = Number(payout.amount);

    if (payout.status === "paid") {
      allTime += amount;
      settledCount += 1;
      // `settled_at` is when the money actually landed; `initiated_at` is when
      // we asked. A payout raised on Sunday and settled on Monday belongs to
      // the week it arrived in, which is the week the artisan felt it.
      const settled = payout.settled_at ? new Date(payout.settled_at) : null;
      if (settled && settled >= monday) thisWeek += amount;
    } else if (payout.status === "pending" || payout.status === "processing") {
      onTheWay += amount;
    } else if (payout.status === "failed") {
      failed += amount;
    }
  }

  return { thisWeek, allTime, onTheWay, failed, settledCount };
}
