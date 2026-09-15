import type { Metadata } from "next";

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

  const [{ count: providerCount }, { count: pendingCount }, { count: categoryCount }] =
    await Promise.all([
      supabase.from("providers").select("profile_id", { count: "exact", head: true }),
      supabase
        .from("providers")
        .select("profile_id", { count: "exact", head: true })
        .eq("verification_status", "pending"),
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Artisans" value={String(providerCount ?? 0)} />
        <Stat label="Awaiting review" value={String(pendingCount ?? 0)} />
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
        description="Phase 0 delivers the foundations. These are the pieces that land on top."
        items={[
          { label: "Review Ghana Cards and approve artisans", phase: "Phase 1" },
          { label: "Set transport rate bands per city", phase: "Phase 2" },
          { label: "Watch jobs and matching in real time", phase: "Phase 3" },
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
