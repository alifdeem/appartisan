import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { RoadmapPanel } from "@/components/app/roadmap-panel";
import { Stat } from "@/components/app/stat";
import { SimulatedBadge } from "@/components/ui/badge";
import { computePlatformNet, computeQuote, formatCedis } from "@/lib/money";
import { isSimulated } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: providerCount },
    { count: pendingCount },
    { count: approvedCount },
    { count: categoryCount },
  ] = await Promise.all([
    supabase.from("providers").select("profile_id", { count: "exact", head: true }),
    supabase
      .from("providers")
      .select("profile_id", { count: "exact", head: true })
      .eq("verification_status", "pending"),
    supabase
      .from("providers")
      .select("profile_id", { count: "exact", head: true })
      .eq("verification_status", "approved"),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  // A worked example on the reference job from PLAN.md §4, computed by the same
  // function the quote builder uses — so the economics on this screen can never
  // drift from the economics the app actually charges.
  const example = computeQuote({ subtotal: 400, transportFee: 40 });
  const { gatewayFee, net } = computePlatformNet(example);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ink-900">Admin</h1>
          <p className="text-[0.9375rem] text-ink-600">
            Verification queue, platform settings and the money.
          </p>
        </div>
        {isSimulated && <SimulatedBadge className="ml-auto" />}
      </div>

      {/* The queue is the only thing on this screen that is somebody waiting.
          It gets its own row above the counters rather than being one of
          them — a number in a tile is a fact, and this is a job to do. */}
      <Link
        href="/admin/verification"
        className="group flex items-center gap-4 rounded-card border border-ink-200 bg-ink-0 px-5 py-4 shadow-sm transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-out-strong hover:border-ink-300 hover:shadow-md"
      >
        <span
          className={
            (pendingCount ?? 0) > 0
              ? "grid size-11 shrink-0 place-items-center rounded-full bg-warning-50 text-warning-700"
              : "grid size-11 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-500"
          }
        >
          <ShieldCheck className="size-5" aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-ink-900">
            Verification queue
          </span>
          <span className="block text-sm text-ink-600">
            {(pendingCount ?? 0) === 0
              ? "Nobody is waiting for review."
              : `${pendingCount} artisan${pendingCount === 1 ? "" : "s"} waiting to be reviewed.`}
          </span>
        </span>

        {(pendingCount ?? 0) > 0 && (
          <span className="tabular shrink-0 font-mono text-2xl font-semibold text-ink-900">
            {pendingCount}
          </span>
        )}

        <ArrowRight
          className="size-4 shrink-0 text-ink-300 transition-transform duration-[var(--duration-fast)] ease-out-strong group-hover:translate-x-0.5 group-hover:text-ink-500"
          aria-hidden
        />
      </Link>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Artisans" value={String(providerCount ?? 0)} />
        <Stat label="Verified" value={String(approvedCount ?? 0)} />
        <Stat label="Active services" value={String(categoryCount ?? 0)} />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Unit economics</h2>
            <p className="text-sm text-ink-600">
              A {formatCedis(example.subtotal)} job with {formatCedis(example.transportFee)}{" "}
              transport, at {example.commissionPct}% commission.
            </p>
          </div>

          <dl className="divide-y divide-ink-100 text-sm">
            <Line label="Artisan's price" value={formatCedis(example.subtotal)} />
            <Line
              label={`Service fee (${example.commissionPct}%)`}
              value={formatCedis(example.serviceFee)}
            />
            <Line label="Transport (passed through in full)" value={formatCedis(example.transportFee)} />
            <Line label="Client pays" value={formatCedis(example.grandTotal)} emphasis />
            <Line label="Artisan receives" value={`− ${formatCedis(example.providerPayout)}`} />
            <Line label="Paystack fee (1.95%)" value={`− ${formatCedis(gatewayFee)}`} />
            <Line label="Platform keeps" value={formatCedis(net)} emphasis />
          </dl>

          <p className="rounded-field bg-ink-100 p-3 text-xs leading-relaxed text-ink-600">
            Transport is reimbursement, not revenue — it goes to the artisan in full, so the
            platform&rsquo;s margin comes only from the service fee. That is why the minimum job
            value matters: at {formatCedis(100)} the same job nets roughly {formatCedis(10)} before
            payout transfer fees.
          </p>
        </CardContent>
      </Card>

      <RoadmapPanel
        title="What's coming to this screen"
        description="Verification is live. These are the pieces that land on top."
        items={[
          { label: "Set transport rate bands per city", phase: "Phase 4" },
          { label: "Watch jobs and matching in real time", phase: "Phase 3" },
          { label: "Step in when matching stalls", phase: "Phase 3" },
          { label: "Trigger payouts and handle failed transfers", phase: "Phase 4" },
          { label: "Resolve disputes and issue refunds", phase: "Phase 6" },
        ]}
      />
    </div>
  );
}

function Line({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className={emphasis ? "font-medium text-ink-900" : "text-ink-600"}>{label}</dt>
      <dd
        className={
          emphasis
            ? "font-mono tabular font-semibold text-ink-900"
            : "font-mono tabular text-ink-700"
        }
      >
        {value}
      </dd>
    </div>
  );
}
