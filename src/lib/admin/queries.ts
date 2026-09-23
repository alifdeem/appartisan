import "server-only";

import { JOB_PHOTO_BUCKET } from "@/lib/jobs/media";
import { jobStatus } from "@/lib/jobs/status";
import { createClient } from "@/lib/supabase/server";
import type {
  DisputeRow,
  JobRow,
  JobStatus,
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

/* -------------------------------------------------------------------------
 * The operations snapshot
 *
 * Everything the console's front page shows, in one round of parallel reads.
 *
 * **The rule this file follows.** Every number here is counted from a table.
 * Nothing is estimated, projected, annualised or inferred from a sample. An
 * operations console whose figures cannot be reconciled against the database
 * is worse than no console, because somebody will make a decision on it.
 *
 * Reads go through the caller's own session, not the service role, so the
 * admin RLS policies are exercised rather than bypassed. If a policy is wrong
 * this screen shows zero, which is the safe direction.
 * ---------------------------------------------------------------------- */

/** One stage of the job funnel, in the order work actually moves through it. */
export interface PipelineStage {
  id: string;
  label: string;
  /** What is sitting at this stage right now. */
  count: number;
  /** Who the stage is waiting on, which is what makes it actionable. */
  waitingOn: "client" | "artisan" | "platform";
}

export interface DayVolume {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  posted: number;
  completed: number;
}

export interface OpsSnapshot {
  /** Work waiting on a human being. */
  triage: {
    verification: number;
    disputes: number;
    stalled: number;
    /** Money that did not reach an artisan. No screen handles this yet. */
    failedPayouts: { count: number; amount: number };
  };
  pipeline: PipelineStage[];
  supply: {
    online: number;
    onJob: number;
    offline: number;
    unapproved: number;
    /** Offers sent and not yet answered. */
    offersPending: number;
  };
  money: {
    /** Charges that actually settled, all time. */
    collected: number;
    /** Transfers that actually landed in an artisan's Mobile Money. */
    paidOut: number;
    /** Commission on jobs that completed. The platform's real revenue. */
    serviceFees: number;
    /** Queued transfers not yet sent. Owed, not earned. */
    owed: number;
  };
  volume: DayVolume[];
  totals: { artisans: number; approved: number; clients: number; categories: number };
}

/** Stages in funnel order. `waitingOn` is who has the ball. */
const PIPELINE: ReadonlyArray<{
  id: string;
  label: string;
  statuses: readonly JobStatus[];
  waitingOn: PipelineStage["waitingOn"];
}> = [
  { id: "finding", label: "Finding an artisan", statuses: ["posted", "matching", "offer_sent"], waitingOn: "platform" },
  { id: "quoting", label: "Waiting on a price", statuses: ["quote_pending", "quote_sent"], waitingOn: "artisan" },
  { id: "deposit", label: "Waiting on a deposit", statuses: ["awaiting_deposit"], waitingOn: "client" },
  { id: "onsite", label: "On the way or on site", statuses: ["deposit_paid", "en_route", "arrived", "in_progress"], waitingOn: "artisan" },
  { id: "signoff", label: "Waiting on sign-off", statuses: ["awaiting_signoff"], waitingOn: "client" },
  { id: "balance", label: "Waiting on the balance", statuses: ["awaiting_balance"], waitingOn: "client" },
] as const;

/**
 * The neutral name for whatever stage a job is at.
 *
 * `jobStatus().label` is written for the client ("Needs your sign-off") and
 * `providerBlurb` for the artisan. Neither addresses an operator, who is a
 * third party to both: "your" is nobody on this screen. Reusing the pipeline's
 * own stage names also means the board and the panel beside it say the same
 * words about the same job, instead of two vocabularies for one state.
 */
export function stageName(status: JobStatus): string {
  /**
   * The pipeline covers live work only, so a closed job finds nothing here.
   *
   * The fallback used to be the raw status, which put `cancelled_by_client`
   * and `awaiting_signoff` on screen as literal enum values the moment the
   * jobs page started listing finished work. `jobStatus` is the status
   * machine every other surface reads its wording from, and it has a written
   * label for all twenty-two states - so that is the fallback, not the
   * database's spelling.
   */
  return PIPELINE.find((stage) => stage.statuses.includes(status))?.label ?? jobStatus(status).label;
}

/** How far back the volume chart looks. Two weeks reads as "recently". */
const VOLUME_DAYS = 14;

export async function getOpsSnapshot(): Promise<OpsSnapshot> {
  const supabase = await createClient();
  const since = new Date(Date.now() - (VOLUME_DAYS - 1) * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);

  // Spelled out rather than routed through a `count(table)` helper: the
  // generated types name every table as a literal union, so a helper taking a
  // `string` loses the checking that makes these queries safe to change.
  const head = { count: "exact", head: true } as const;

  const [
    artisans,
    approved,
    clients,
    categories,
    verification,
    disputes,
    stalled,
    offersPending,
    providerRows,
    jobRows,
    paymentRows,
    payoutRows,
    quoteRows,
    volumeRows,
  ] = await Promise.all([
    supabase.from("providers").select("profile_id", head),
    supabase.from("providers").select("profile_id", head).eq("verification_status", "approved"),
    supabase.from("clients").select("profile_id", head),
    supabase.from("categories").select("id", head).eq("is_active", true),
    supabase.from("providers").select("profile_id", head).eq("verification_status", "pending"),
    supabase.from("disputes").select("id", head).in("status", ["open", "investigating"]),
    supabase.from("jobs").select("id", head).in("status", ["unmatched", "expired_no_match"]),
    supabase.from("job_offers").select("id", head).eq("status", "pending"),
    supabase.from("providers").select("availability, verification_status"),
    supabase.from("jobs").select("status"),
    supabase.from("payments").select("amount, status"),
    supabase.from("payouts").select("amount, status"),
    // Commission is only real once the job it belongs to was paid for.
    supabase.from("quotes").select("service_fee_amount, status, job:jobs!inner(status)").eq("status", "accepted"),
    supabase.from("jobs").select("status, created_at, closed_at").gte("created_at", since.toISOString()),
  ]);

  // ---- supply -----------------------------------------------------------
  const providers = providerRows.data ?? [];
  const live = providers.filter((p) => p.verification_status === "approved");

  // ---- pipeline ---------------------------------------------------------
  const byStatus = new Map<string, number>();
  for (const job of jobRows.data ?? []) {
    byStatus.set(job.status, (byStatus.get(job.status) ?? 0) + 1);
  }

  // ---- money ------------------------------------------------------------
  const sum = <T extends { amount: number | string; status: string }>(rows: T[], status: string) =>
    rows.filter((r) => r.status === status).reduce((t, r) => t + Number(r.amount), 0);

  const payments = paymentRows.data ?? [];
  const payouts = payoutRows.data ?? [];

  const serviceFees = (quoteRows.data ?? [])
    .filter((q) => {
      const job = q.job as unknown as { status: string } | null;
      return job?.status === "paid" || job?.status === "closed";
    })
    .reduce((t, q) => t + Number(q.service_fee_amount), 0);

  // ---- volume -----------------------------------------------------------
  const days = new Map<string, DayVolume>();
  for (let i = 0; i < VOLUME_DAYS; i++) {
    const d = new Date(since.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    days.set(key, { date: key, posted: 0, completed: 0 });
  }
  for (const job of volumeRows.data ?? []) {
    const posted = days.get(String(job.created_at).slice(0, 10));
    if (posted) posted.posted += 1;
    if (job.closed_at) {
      const done = days.get(String(job.closed_at).slice(0, 10));
      if (done) done.completed += 1;
    }
  }

  return {
    triage: {
      verification: verification.count ?? 0,
      disputes: disputes.count ?? 0,
      stalled: stalled.count ?? 0,
      failedPayouts: {
        count: payouts.filter((p) => p.status === "failed").length,
        amount: sum(payouts, "failed"),
      },
    },
    pipeline: PIPELINE.map((stage) => ({
      id: stage.id,
      label: stage.label,
      waitingOn: stage.waitingOn,
      count: stage.statuses.reduce((t, s) => t + (byStatus.get(s) ?? 0), 0),
    })),
    supply: {
      online: live.filter((p) => p.availability === "online").length,
      onJob: live.filter((p) => p.availability === "on_job").length,
      offline: live.filter((p) => p.availability === "offline").length,
      unapproved: providers.length - live.length,
      offersPending: offersPending.count ?? 0,
    },
    money: {
      collected: sum(payments, "succeeded"),
      paidOut: sum(payouts, "paid"),
      serviceFees,
      owed: sum(payouts, "pending") + sum(payouts, "processing"),
    },
    volume: [...days.values()],
    totals: {
      artisans: artisans.count ?? 0,
      approved: approved.count ?? 0,
      clients: clients.count ?? 0,
      categories: categories.count ?? 0,
    },
  };
}

/**
 * Just the three queue counts the navigation rail badges.
 *
 * Separate from `getOpsSnapshot` because the layout runs on every admin
 * screen and must not pull the whole payments and quotes history to draw
 * three numbers.
 */
export async function getAdminNavCounts(): Promise<{
  verification: number;
  disputes: number;
  stalled: number;
}> {
  const supabase = await createClient();
  const head = { count: "exact", head: true } as const;

  const [verification, disputes, stalled] = await Promise.all([
    supabase.from("providers").select("profile_id", head).eq("verification_status", "pending"),
    supabase.from("disputes").select("id", head).in("status", ["open", "investigating"]),
    supabase.from("jobs").select("id", head).in("status", ["unmatched", "expired_no_match"]),
  ]);

  return {
    verification: verification.count ?? 0,
    disputes: disputes.count ?? 0,
    stalled: stalled.count ?? 0,
  };
}

/* -------------------------------------------------------------------------
 * The live board
 * ---------------------------------------------------------------------- */

export interface LiveJobRow {
  id: string;
  reference: string;
  status: JobStatus;
  trade: string | null;
  icon: string | null;
  landmark: string | null;
  clientName: string | null;
  providerName: string | null;
  /** Quote total where one has been agreed. Null before a price exists. */
  value: number | null;
  /** When this job last moved, which is what "stuck" is measured from. */
  movedAt: string;
}

/**
 * Every job that is currently running, oldest movement first.
 *
 * **Why the overview needs rows and not only counts.** A console made
 * entirely of totals tells an operator that something is wrong but never
 * which thing, so every answer costs a navigation. The aggregate panels say
 * *six jobs are waiting on a deposit*; this says *which six*, whose they are
 * and how long they have sat there. Sorted by `updated_at` ascending so the
 * job that has not moved in two days is the first row, not the last.
 */
/** Statuses that count as work in progress. Exported: the jobs page filters on them too. */
export const LIVE_STATUSES = [
  "posted",
  "matching",
  "offer_sent",
  "quote_pending",
  "quote_sent",
  "awaiting_deposit",
  "deposit_paid",
  "en_route",
  "arrived",
  "in_progress",
  "awaiting_signoff",
  "awaiting_balance",
] as const satisfies readonly JobStatus[];

export const CLOSED_STATUSES = [
  "paid",
  "closed",
  "cancelled_by_client",
  "cancelled_by_provider",
  "disputed",
  "unmatched",
  "expired_no_match",
] as const satisfies readonly JobStatus[];

/** One select, so the board and the jobs page cannot drift apart. */
export const BOARD_SELECT = `id, reference, status, landmark, updated_at,
   category:categories ( name, icon ),
   client:clients ( profile:profiles ( full_name ) ),
   provider:providers ( profile:profiles ( full_name ) ),
   quotes ( total, status )`;

/**
 * The overview's board: live work, or the most recent work when nothing is live.
 *
 * **Why it falls back instead of emptying.** A marketplace this size is
 * genuinely idle for stretches of the day, and a panel that shows an empty
 * state most of the time has not earned the largest cell on the screen.
 * Falling back to what just closed keeps it answering *is this thing working*
 * rather than going blank.
 *
 * The mode travels with the rows so the card can say which set it is showing.
 * A table of finished jobs under a heading that says "live" would be a lie,
 * and "idle for 6 days" against a job that closed last Tuesday is nonsense.
 */
export async function listJobBoard(
  limit = 8,
): Promise<{ rows: LiveJobRow[] | null; mode: "live" | "recent" }> {
  const live = await listLiveJobs(limit);
  if (live === null) return { rows: null, mode: "live" };
  if (live.length > 0) return { rows: live, mode: "live" };
  return { rows: await listRecentJobs(limit), mode: "recent" };
}

/** Finished work, newest first. The fallback for an idle board. */
export async function listRecentJobs(limit = 8): Promise<LiveJobRow[] | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select(BOARD_SELECT)
    .in("status", CLOSED_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[admin] listRecentJobs failed", error.message);
    return null;
  }

  return (data ?? []).map(toBoardRow);
}

export async function listLiveJobs(limit = 8): Promise<LiveJobRow[] | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select(BOARD_SELECT)
    .in("status", LIVE_STATUSES)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    /**
     * Null, not an empty array.
     *
     * The first version returned `[]` here, and the board rendered its empty
     * state: "No jobs are running right now." That is a confident, specific,
     * wrong answer, and it hid a broken join for as long as it took somebody
     * to notice the pipeline panel disagreeing with it. A screen must be able
     * to tell "there is nothing" from "I could not find out".
     */
    console.error("[admin] listLiveJobs failed", error.message);
    return null;
  }

  return (data ?? []).map(toBoardRow);
}

/** One row of the board, from whichever query fetched it. */
function toBoardRow(job: {
  id: string;
  reference: string;
  status: JobStatus;
  landmark: string | null;
  updated_at: string;
  category: unknown;
  client: unknown;
  provider: unknown;
  quotes: unknown;
}): LiveJobRow {
  /**
   * The joins are nested, and the first version of this mapper was not.
   *
   * `client:clients ( profile:profiles ( full_name ) )` returns
   * `{ profile: { full_name } }`, not `{ full_name }`. Casting it flat made
   * `clientName` silently `undefined` on every row, so the board rendered
   * "Unknown" in the Client column and "not assigned" under Artisan for jobs
   * that plainly had both. A cast cannot fail, which is exactly why this was
   * invisible until the rows were looked at.
   */
  const category = job.category as { name: string; icon: string } | null;
  const client = job.client as { profile: { full_name: string } | null } | null;
  const provider = job.provider as { profile: { full_name: string } | null } | null;
  const quotes = (job.quotes ?? []) as { total: number; status: string }[];

  // The agreed price if there is one, otherwise the one on the table.
  const agreed =
    quotes.find((q) => q.status === "accepted") ?? quotes.find((q) => q.status === "sent");

  return {
    id: job.id,
    reference: job.reference,
    status: job.status,
    trade: category?.name ?? null,
    icon: category?.icon ?? null,
    landmark: job.landmark,
    clientName: client?.profile?.full_name ?? null,
    providerName: provider?.profile?.full_name ?? null,
    value: agreed ? Number(agreed.total) : null,
    movedAt: job.updated_at,
  };
}

/* -------------------------------------------------------------------------
 * The full ledgers
 *
 * The overview shows eight rows because it is a summary. These two answer the
 * questions a summary cannot: *every* job, and *every* movement of money.
 * ---------------------------------------------------------------------- */

export type JobFilter = "live" | "closed" | "all";

export interface JobsPage {
  rows: LiveJobRow[] | null;
  /** Total matching the filter, which is what makes paging honest. */
  total: number;
  counts: { live: number; closed: number; all: number };
}

export const JOBS_PER_PAGE = 25;

/**
 * Every job, filtered and paged.
 *
 * Ordered by `updated_at` rather than `created_at`: this list is read to find
 * out what is happening, and a job posted three weeks ago that moved an hour
 * ago is more interesting than one posted this morning and untouched since.
 *
 * `search` matches the reference only. It is tempting to search client names
 * too, but the reference is the one identifier that appears on the client's
 * screen, in the artisan's app and in a payment provider's dashboard - so it
 * is what somebody has in front of them when they come to this page.
 */
export async function listAllJobs({
  filter = "all",
  page = 0,
  search,
}: {
  filter?: JobFilter;
  page?: number;
  search?: string;
} = {}): Promise<JobsPage> {
  const supabase = await createClient();
  const head = { count: "exact", head: true } as const;

  const [liveCount, closedCount, allCount] = await Promise.all([
    supabase.from("jobs").select("id", head).in("status", LIVE_STATUSES),
    supabase.from("jobs").select("id", head).in("status", CLOSED_STATUSES),
    supabase.from("jobs").select("id", head).neq("status", "draft"),
  ]);

  let query = supabase.from("jobs").select(BOARD_SELECT, { count: "exact" });

  if (filter === "live") query = query.in("status", LIVE_STATUSES);
  else if (filter === "closed") query = query.in("status", CLOSED_STATUSES);
  // A draft is a half-filled form on somebody's phone, not a job. It appears
  // in no count and no list here.
  else query = query.neq("status", "draft");

  if (search) query = query.ilike("reference", `%${search}%`);

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(page * JOBS_PER_PAGE, page * JOBS_PER_PAGE + JOBS_PER_PAGE - 1);

  const counts = {
    live: liveCount.count ?? 0,
    closed: closedCount.count ?? 0,
    all: allCount.count ?? 0,
  };

  if (error) {
    console.error("[admin] listAllJobs failed", error.message);
    return { rows: null, total: 0, counts };
  }

  return { rows: (data ?? []).map(toBoardRow), total: count ?? 0, counts };
}

export interface LedgerEntry {
  id: string;
  /** `in` is a client paying us. `out` is us paying an artisan. */
  direction: "in" | "out";
  kind: string;
  status: string;
  amount: number;
  reference: string | null;
  jobReference: string | null;
  jobId: string | null;
  counterparty: string | null;
  at: string;
  failureReason: string | null;
  simulated: boolean;
}

export interface LedgerPage {
  rows: LedgerEntry[] | null;
  totals: { in: number; out: number; failedIn: number; failedOut: number; pendingOut: number };
}

/**
 * Every movement of money, both directions, on one timeline.
 *
 * **Why one list and not two.** Payments and payouts live in separate tables
 * because they are separate mechanisms, but an operator asking "what happened
 * to this job's money" does not care about that boundary: they want the
 * charge and the transfer next to each other in the order they occurred.
 * Splitting the screen in two makes them do the interleaving by eye.
 *
 * A failed transfer is the reason this page exists. It is money a client paid
 * that never reached the artisan who earned it, and until now nothing in the
 * console showed it at all.
 */
export async function listLedger(limit = 60): Promise<LedgerPage> {
  const supabase = await createClient();

  const [payments, payouts] = await Promise.all([
    supabase
      .from("payments")
      .select(
        `id, leg, status, amount, provider_reference, failure_reason, is_simulated, created_at,
         job:jobs ( id, reference, client:clients ( profile:profiles ( full_name ) ) )`,
      )
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("payouts")
      .select(
        `id, status, amount, transfer_reference, failure_reason, is_simulated, initiated_at, settled_at,
         job:jobs ( id, reference ),
         provider:providers ( profile:profiles ( full_name ) )`,
      )
      .order("initiated_at", { ascending: false })
      .limit(limit),
  ]);

  if (payments.error || payouts.error) {
    console.error(
      "[admin] listLedger failed",
      payments.error?.message ?? payouts.error?.message,
    );
    return { rows: null, totals: { in: 0, out: 0, failedIn: 0, failedOut: 0, pendingOut: 0 } };
  }

  const nameOf = (v: unknown) =>
    (v as { profile: { full_name: string } | null } | null)?.profile?.full_name ?? null;

  const inRows: LedgerEntry[] = (payments.data ?? []).map((p) => {
    const job = p.job as unknown as
      | { id: string; reference: string; client: unknown }
      | null;
    return {
      id: p.id,
      direction: "in",
      kind: p.leg,
      status: p.status,
      amount: Number(p.amount),
      reference: p.provider_reference,
      jobReference: job?.reference ?? null,
      jobId: job?.id ?? null,
      counterparty: nameOf(job?.client),
      at: p.created_at,
      failureReason: p.failure_reason,
      simulated: p.is_simulated,
    };
  });

  const outRows: LedgerEntry[] = (payouts.data ?? []).map((p) => {
    const job = p.job as unknown as { id: string; reference: string } | null;
    return {
      id: p.id,
      direction: "out",
      kind: "payout",
      status: p.status,
      amount: Number(p.amount),
      reference: p.transfer_reference,
      jobReference: job?.reference ?? null,
      jobId: job?.id ?? null,
      counterparty: nameOf(p.provider),
      // Settled time where we have it: that is when the artisan actually saw
      // the money, which is the event worth ordering by.
      at: p.settled_at ?? p.initiated_at,
      failureReason: p.failure_reason,
      simulated: p.is_simulated,
    };
  });

  const rows = [...inRows, ...outRows].sort((a, b) => b.at.localeCompare(a.at));
  const sum = (set: LedgerEntry[], status: string) =>
    set.filter((r) => r.status === status).reduce((t, r) => t + r.amount, 0);

  return {
    rows,
    totals: {
      in: sum(inRows, "succeeded"),
      out: sum(outRows, "paid"),
      failedIn: sum(inRows, "failed"),
      failedOut: sum(outRows, "failed"),
      pendingOut: sum(outRows, "pending") + sum(outRows, "processing"),
    },
  };
}
