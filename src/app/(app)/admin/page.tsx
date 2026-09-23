import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Radar, ShieldAlert, ShieldCheck } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/card";
import { LiveBoard } from "@/components/admin/live-board";
import { Figure } from "@/components/admin/figure";
import { VolumeChart } from "@/components/admin/volume-chart";
import {
  getOpsSnapshot,
  listJobBoard,
  type PipelineStage,
} from "@/lib/admin/queries";
import { computePlatformNet, computeQuote, formatCedis } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

/**
 * The operations overview.
 *
 * **What changed, and why.** This screen used to be six identical full-width
 * link rows stacked down the page, with the actual counters below them. The
 * rows were navigation that had nowhere to live; now there is a rail, so the
 * page can answer the question an operator actually opens it with: *is
 * anything wrong, and is the marketplace moving?*
 *
 * **Reading order is severity, then flow, then money.** Triage first, because
 * it is the only band where somebody is waiting on a human. Then the pipeline
 * and the supply that has to meet it. Then what the platform collected and
 * paid out. The worked example goes last: it is a reference, not a reading.
 *
 * **Every number is counted, none is projected.** See `getOpsSnapshot`. The
 * one exception is the unit-economics block, which is explicitly a worked
 * example on a fixed job and is labelled as one.
 */
export default async function AdminOverview() {
  const [snapshot, board] = await Promise.all([
    getOpsSnapshot(),
    listJobBoard(),
  ]);
  const { triage, pipeline, supply, money, volume, totals } = snapshot;

  const example = computeQuote({ subtotal: 400, transportFee: 40 });
  const { gatewayFee, net } = computePlatformNet(example);

  const queues = [
    {
      href: "/admin/verification",
      icon: ShieldCheck,
      label: "Artisans to verify",
      count: triage.verification,
      clear: "Nobody is waiting",
      tone: "warning" as const,
    },
    {
      href: "/admin/disputes",
      icon: ShieldAlert,
      label: "Disputes to decide",
      count: triage.disputes,
      clear: "Nothing reported",
      tone: "danger" as const,
    },
    {
      href: "/admin/matching",
      icon: Radar,
      label: "Jobs nobody took",
      count: triage.stalled,
      clear: "Every job was placed",
      tone: "warning" as const,
    },
  ];

  const waiting = queues.reduce((t, q) => t + q.count, 0);
  const inFlight = pipeline.reduce((t, s) => t + s.count, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-space text-title font-bold text-navy-900">
            Operations
          </h1>
          <p className="mt-1 text-note text-copy-muted">
            {waiting === 0
              ? "Nothing is waiting on you."
              : `${waiting} ${waiting === 1 ? "thing needs" : "things need"} a decision.`}{" "}
            {inFlight} {inFlight === 1 ? "job is" : "jobs are"} in flight.
          </p>
        </div>

        <dl className="flex items-center gap-6">
          <CountUp
            label="Artisans"
            value={totals.approved}
            of={totals.artisans}
          />
          <CountUp label="Clients" value={totals.clients} />
          <CountUp label="Trades" value={totals.categories} />
        </dl>
      </header>

      {/* ---- triage ------------------------------------------------------
          Three tiles, and they change character rather than just colour when
          a queue is empty: a cleared queue loses its tint and its arrow, so a
          glance down the row reads as "nothing here" without counting zeros. */}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {queues.map((queue, index) => (
          <li
            key={queue.href}
            // Two columns on a tablet, three on a laptop. Three across at
            // 820px left the labels a few pixels short of fitting, so one
            // wrapped and its neighbours did not. The last tile spans the
            // pair rather than leaving a hole beside it.
            className={
              index === queues.length - 1
                ? "sm:col-span-2 xl:col-span-1"
                : undefined
            }
          >
            <QueueTile {...queue} />
          </li>
        ))}
      </ul>

      {triage.failedPayouts.count > 0 && (
        <FailedPayouts {...triage.failedPayouts} />
      )}

      {/* ---- the live board, and the shape of the queue beside it ---------
          The board is the page's centre of gravity. Everything around it is
          an aggregate; this is the only part that names an actual job, and it
          is what turns "six are waiting on a deposit" into something an
          operator can act on without navigating first. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{board.mode === "live" ? "Live board" : "Recently finished"}</CardTitle>
            <CardDescription>
              {board.mode === "live"
                ? "The one that has moved least recently, first."
                : "Nothing is running. The last jobs to close."}
            </CardDescription>
            {/* The link is hidden on a phone, the slot is not. shadcn's header
                reserves column 2 for the action via `:has()`, and a `hidden`
                CardAction leaves the grid two columns wide with nothing
                claiming the second - so the description flowed up into it and
                sat beside the title instead of under it. Hiding the link and
                keeping the wrapper collapses that column to zero and leaves
                the placement intact. The link itself is a duplicate of the
                drawer's Matching item, so the phone loses nothing. */}
            <CardAction>
              <Link
                href="/admin/matching"
                className="tap hidden items-center gap-1 text-note font-semibold text-azure-600 underline-offset-4 hover:underline sm:inline-flex"
              >
                Matching
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </CardAction>
          </CardHeader>

          <CardContent className="justify-start px-1.5 py-1.5">
            <LiveBoard rows={board.rows} mode={board.mode} />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Where the work is</CardTitle>
              <CardDescription>
                Share of live jobs, by what holds them up.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inFlight === 0 ? (
                <Empty>Nothing is running.</Empty>
              ) : (
                <ul className="space-y-3">
                  {pipeline.map((stage) => (
                    <li key={stage.id}>
                      <StageBar stage={stage} total={inFlight} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Who is available</CardTitle>
              <CardDescription>Approved artisans, right now.</CardDescription>
            </CardHeader>
            <CardContent className="gap-5">
              <AvailabilityBar {...supply} />

              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-hairline pt-4">
                <Figure
                  label="Offers unanswered"
                  value={String(supply.offersPending)}
                />
                <Figure
                  label="Not yet approved"
                  value={String(supply.unapproved)}
                  tone={supply.unapproved > 0 ? "warning" : "muted"}
                />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---- volume and money -------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Volume</CardTitle>
            <CardDescription>
              Posted against completed, the last fortnight.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VolumeChart data={volume} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Money</CardTitle>
            <CardDescription>
              Settled figures only. Nothing here is a projection.
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
              <Figure
                label="Collected"
                value={formatCedis(money.collected)}
                sub="Charges that cleared"
              />
              <Figure
                label="Paid to artisans"
                value={formatCedis(money.paidOut)}
                sub="Transfers that landed"
              />
              <Figure
                label="Service fees"
                value={formatCedis(money.serviceFees)}
                tone="positive"
                sub="On completed jobs"
              />
              <Figure
                label="Queued to send"
                value={formatCedis(money.owed)}
                tone={money.owed > 0 ? "warning" : "muted"}
                sub="Owed, not earned"
              />
            </dl>

            <p className="border-t border-hairline pt-4 text-2xs leading-relaxed text-copy-muted">
              Transport is reimbursement, not revenue. It reaches the artisan in
              full, so the platform&rsquo;s margin is the service fee alone.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---- the worked example ------------------------------------------
          Three columns that are three *steps*, not three arbitrary thirds.
          The previous version laid seven lines into a 3-column grid, which
          flows left-to-right and so read "artisan's price, service fee,
          transport / client pays, artisan receives, Paystack fee" — money
          going in and money going out interleaved on the same row. Money has
          a direction, and the layout now follows it: what comes in, what goes
          back out, what is left. */}
      <Card>
        <CardHeader>
          <CardTitle>Unit economics</CardTitle>
          <CardDescription>
            A worked example on a {formatCedis(example.subtotal)} job with{" "}
            {formatCedis(example.transportFee)} transport at{" "}
            {example.commissionPct}%. Not a reading of live data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-10 gap-y-6 md:grid-cols-3">
            <Ledger
              step="The client pays"
              total={formatCedis(example.grandTotal)}
              lines={[
                ["Artisan's price", formatCedis(example.subtotal)],
                [
                  `Service fee (${example.commissionPct}%)`,
                  formatCedis(example.serviceFee),
                ],
                ["Transport", formatCedis(example.transportFee)],
              ]}
            />
            <Ledger
              step="We pay out"
              total={`- ${formatCedis(example.providerPayout + gatewayFee)}`}
              lines={[
                ["To the artisan", `- ${formatCedis(example.providerPayout)}`],
                ["Paystack fee (1.95%)", `- ${formatCedis(gatewayFee)}`],
              ]}
            />
            <Ledger
              step="We keep"
              total={formatCedis(net)}
              positive
              lines={[
                ["Service fee collected", formatCedis(example.serviceFee)],
                ["Less the gateway", `- ${formatCedis(gatewayFee)}`],
              ]}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function QueueTile({
  href,
  icon: Icon,
  label,
  count,
  clear,
  tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  clear: string;
  tone: "warning" | "danger";
}) {
  const active = count > 0;

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full items-center gap-4 rounded-[1.25rem] border p-5",
        "transition-[border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-out-strong",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-sheet)] active:translate-y-0",
        active
          ? tone === "danger"
            ? "border-danger-500/30 bg-danger-50/50 shadow-[var(--shadow-float)]"
            : "border-warning-500/35 bg-warning-50/50 shadow-[var(--shadow-float)]"
          : "border-hairline bg-white",
      )}
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-[0.875rem]",
          active
            ? tone === "danger"
              ? "bg-danger-500/12 text-danger-700"
              : "bg-warning-500/15 text-warning-700"
            : "bg-azure-50 text-copy-muted",
        )}
      >
        <Icon className="size-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-note font-semibold text-navy-900">
          {label}
        </span>
        <span className="mt-0.5 block text-2xs text-copy-muted">
          {active ? "Waiting now" : clear}
        </span>
      </span>

      {active ? (
        <span
          className={cn(
            "tabular shrink-0 font-mono text-title font-bold",
            tone === "danger" ? "text-danger-700" : "text-warning-700",
          )}
        >
          {count}
        </span>
      ) : (
        <ArrowRight className="size-4 shrink-0 text-hairline transition-transform duration-[var(--duration-fast)] ease-out-strong group-hover:translate-x-0.5 group-hover:text-azure-500" />
      )}
    </Link>
  );
}

/**
 * Transfers that failed.
 *
 * Loud, and deliberately not a link: there is no screen that retries a
 * transfer yet. A tile that looks clickable and goes nowhere is worse than a
 * plain statement of the problem, so this says where the money is instead.
 */
function FailedPayouts({ count, amount }: { count: number; amount: number }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[1.25rem] border border-danger-500/30 bg-danger-50/60 px-5 py-4"
    >
      <span className="tabular font-mono text-title-sm font-bold text-danger-700">
        {formatCedis(amount)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-note font-semibold text-navy-900">
          {count} {count === 1 ? "payout" : "payouts"} did not reach an artisan
        </span>
        <span className="mt-0.5 block text-2xs text-copy-muted">
          The sweep retries a transfer once its Mobile Money details are fixed.
          There is no screen for this yet.
        </span>
      </span>
    </div>
  );
}

const WAITING_ON: Record<
  PipelineStage["waitingOn"],
  { label: string; bar: string; dot: string }
> = {
  client: { label: "Client", bar: "bg-azure-500", dot: "bg-azure-500" },
  artisan: { label: "Artisan", bar: "bg-navy-800", dot: "bg-navy-800" },
  platform: { label: "Us", bar: "bg-warning-500", dot: "bg-warning-500" },
};

/**
 * One funnel stage.
 *
 * **The bar is a share of all live work, not a share of the busiest stage.**
 * Scaling to the peak was the first attempt and it fails on exactly the data
 * you see most often: when every stage holds a similar number, the peak is
 * that number, every bar fills its track, and the panel reads "everything is
 * at capacity" when it actually means "three jobs". Against the total, a bar
 * carries a quantity somebody can interpret - a third of live work is sitting
 * here - and the stage that is backing up is still the widest.
 *
 * The floor keeps a single job visible. Without it one job in twelve is two
 * pixels, which reads as an empty stage and hides the thing the panel exists
 * to surface.
 */
function StageBar({ stage, total }: { stage: PipelineStage; total: number }) {
  const who = WAITING_ON[stage.waitingOn];
  const share = total > 0 ? stage.count / total : 0;
  const width = stage.count === 0 ? 0 : Math.max(share * 100, 5);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn("size-1.5 shrink-0 rounded-full", who.dot)}
            aria-hidden
          />
          <span className="truncate text-note text-copy">{stage.label}</span>
          <span className="shrink-0 text-2xs text-copy-muted">{who.label}</span>
        </span>
        <span
          className={cn(
            "tabular shrink-0 font-mono text-note font-semibold",
            stage.count > 0 ? "text-navy-900" : "text-copy-muted",
          )}
        >
          {stage.count}
        </span>
      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-azure-50">
        <div
          className={cn("h-full rounded-full", who.bar)}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

/** Availability as one bar, because these three are parts of one whole. */
function AvailabilityBar({
  online,
  onJob,
  offline,
}: {
  online: number;
  onJob: number;
  offline: number;
}) {
  const total = online + onJob + offline;
  const parts = [
    { key: "online", label: "Free now", value: online, fill: "bg-success-500" },
    { key: "onJob", label: "On a job", value: onJob, fill: "bg-navy-800" },
    { key: "offline", label: "Offline", value: offline, fill: "bg-hairline" },
  ];

  if (total === 0) return <Empty>No approved artisans yet.</Empty>;

  return (
    <div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full"
        role="presentation"
      >
        {parts.map((part) =>
          part.value > 0 ? (
            <div
              key={part.key}
              className={part.fill}
              style={{ width: `${(part.value / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>

      <dl className="mt-4 space-y-2">
        {parts.map((part) => (
          <div key={part.key} className="flex items-center gap-2.5">
            <span
              className={cn("size-2 shrink-0 rounded-full", part.fill)}
              aria-hidden
            />
            <dt className="flex-1 text-note text-copy">{part.label}</dt>
            <dd className="tabular font-mono text-note font-semibold text-navy-900">
              {part.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CountUp({
  label,
  value,
  of,
}: {
  label: string;
  value: number;
  of?: number;
}) {
  return (
    <div className="text-right">
      <dt className="text-2xs text-copy-muted">{label}</dt>
      <dd className="tabular font-mono text-lede font-semibold text-navy-900">
        {value}
        {of !== undefined && of !== value && (
          <span className="text-note font-normal text-copy-muted"> / {of}</span>
        )}
      </dd>
    </div>
  );
}

/** One step of the money's journey: its parts, then its total. */
function Ledger({
  step,
  lines,
  total,
  positive,
}: {
  step: string;
  lines: ReadonlyArray<readonly [string, string]>;
  total: string;
  positive?: boolean;
}) {
  return (
    <div>
      <h3 className="text-2xs font-semibold tracking-[0.06em] text-copy-muted uppercase">
        {step}
      </h3>

      <dl className="mt-2.5">
        {lines.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 py-1.5"
          >
            <dt className="text-note text-copy-muted">{label}</dt>
            <dd className="tabular font-mono text-note text-copy">{value}</dd>
          </div>
        ))}

        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-hairline pt-2.5">
          <dt className="text-note font-semibold text-navy-900">Total</dt>
          <dd
            className={cn(
              "tabular font-mono text-lede font-bold",
              positive ? "text-success-700" : "text-navy-900",
            )}
          >
            {total}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[0.875rem] border border-dashed border-hairline bg-azure-50/40 px-4 py-6 text-center text-note text-copy-muted">
      {children}
    </p>
  );
}
