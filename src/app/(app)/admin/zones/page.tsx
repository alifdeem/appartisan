import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { ZoneEditor } from "@/app/(app)/admin/zones/_components/zone-editor";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCedis } from "@/lib/money";
import type { TransportZoneRow } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Transport bands" };

/**
 * What an artisan is paid to travel.
 *
 * PLAN.md §16 leaves the real Accra and Tema numbers open — what is in the
 * database now is a placeholder ladder, and this screen exists so the client
 * can replace it with figures that reflect actual fuel and traffic without
 * waiting for a deploy.
 *
 * The screen states the thing an admin most needs to understand before
 * touching it: transport is a **cost reimbursement, not revenue**. It passes to
 * the artisan in full, so raising a band raises what the client pays and the
 * artisan receives, and changes the platform's margin by nothing at all
 * (PLAN.md §4).
 */
export default async function TransportZonesPage() {
  const supabase = await createClient();

  const { data: zones } = await supabase
    .from("transport_zones")
    .select("*")
    .order("city")
    .order("min_km");

  const rows = (zones ?? []) as TransportZoneRow[];
  const active = rows.filter((zone) => zone.is_active);

  // A hole in the ladder resolves to no band, and `save_quote` coalesces a
  // missing fee to zero — an artisan travelling for nothing. Worth surfacing
  // rather than leaving to be discovered on a real job.
  const gaps: string[] = [];
  const byCity = new Map<string, TransportZoneRow[]>();
  for (const zone of active) {
    byCity.set(zone.city, [...(byCity.get(zone.city) ?? []), zone]);
  }

  for (const [city, cityZones] of byCity) {
    const sorted = [...cityZones].sort((a, b) => Number(a.min_km) - Number(b.min_km));
    if (Number(sorted[0].min_km) > 0) {
      gaps.push(`${city}: nothing covers 0–${sorted[0].min_km}km`);
    }
    for (let i = 1; i < sorted.length; i++) {
      const previousMax = Number(sorted[i - 1].max_km);
      const currentMin = Number(sorted[i].min_km);
      if (currentMin > previousMax) {
        gaps.push(`${city}: nothing covers ${previousMax}–${currentMin}km`);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Admin
        </Link>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ink-900">Transport bands</h1>
          <p className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-600">
            What a client pays for travel, by how far the artisan has to come. Charged upfront
            with the deposit so nobody is out of pocket for a journey.
          </p>
        </div>
      </div>

      <Card className="border-brand-200 bg-brand-50">
        <CardContent className="space-y-1.5">
          <h2 className="text-sm font-semibold text-brand-900">
            This is reimbursement, not revenue
          </h2>
          <p className="max-w-prose text-sm leading-relaxed text-brand-900/85">
            Every cedi here goes to the artisan in full. Raising a band raises what the client
            pays and what the artisan receives, and leaves the platform&rsquo;s margin exactly
            where it was — that comes only from the {12}% service fee.
          </p>
        </CardContent>
      </Card>

      {gaps.length > 0 && (
        <div
          role="alert"
          className="space-y-1.5 rounded-card border border-warning-500/40 bg-warning-50 px-4 py-3.5"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-warning-700">
            <AlertTriangle className="size-4" aria-hidden />
            Gaps in the ladder
          </p>
          <ul className="space-y-0.5 text-sm text-ink-700">
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-ink-600">
            A distance that falls in a gap gets no band at all, and a quote built on it charges
            nothing for travel.
          </p>
        </div>
      )}

      <ZoneEditor zones={rows} />

      <p className="text-xs leading-relaxed text-ink-500">
        A worked example on the ladder as it stands: a job in the{" "}
        {active[1] ? `${active[1].min_km}–${active[1].max_km}km` : "middle"} band adds{" "}
        {active[1] ? formatCedis(Number(active[1].fee)) : "—"} to the deposit, all of which
        reaches the artisan.
      </p>
    </div>
  );
}
