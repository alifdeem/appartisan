import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Pencil } from "lucide-react";

import { SubmitApplication } from "@/app/(app)/provider/apply/review/_components/submit-application";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MOMO_NETWORK_LABELS, formatPhoneForDisplay } from "@/lib/phone";
import { REQUIRED_DOCS, docLabel } from "@/lib/providers/documents";
import {
  getApplicationGaps,
  getMyProvider,
  listProviderCategories,
  listProviderDocuments,
} from "@/lib/providers/queries";
import { getCurrentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Send for review" };

/**
 * The last screen before the queue.
 *
 * **What is missing comes from the database, not from this page.**
 * `provider_application_gaps()` is the same function `submit_provider_application()`
 * checks against, so the list an artisan reads here cannot disagree with the
 * thing that will refuse them. A checklist that says "ready" over a button that
 * says "not finished" is worse than no checklist.
 *
 * The documents are listed by name and not shown. An artisan has just looked at
 * all three on the previous screen; reprinting somebody's identity card on a
 * summary page is a second place for it to be over-the-shoulder readable, for
 * no new information.
 */
export default async function ReviewStepPage() {
  const provider = await getMyProvider();
  if (!provider) redirect("/provider");

  const [profile, trades, documents, gaps] = await Promise.all([
    getCurrentProfile(),
    listProviderCategories(provider.profile_id),
    listProviderDocuments(provider.profile_id),
    getApplicationGaps(provider.profile_id),
  ]);

  const ready = gaps.length === 0;
  const docTypes = new Set(documents.map((doc) => doc.doc_type));

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-navy-900">Check it over</h2>
        <p className="max-w-prose text-[0.9375rem] leading-relaxed text-copy-muted">
          Once this goes in, our team reviews your documents and calls you to confirm a few
          details. You cannot edit it while it is being reviewed.
        </p>
      </div>

      {!ready && (
        <div
          role="alert"
          className="animate-fade-in space-y-2 rounded-card border border-warning-500/40 bg-warning-50 px-4 py-3.5"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-warning-700">
            <AlertTriangle className="size-4" aria-hidden />
            Not quite ready
          </p>
          <ul className="space-y-1 text-sm leading-relaxed text-copy">
            {gaps.map((gap) => (
              <li key={gap} className="flex gap-2">
                <span aria-hidden className="text-warning-700">
                  •
                </span>
                {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardContent className="space-y-5">
          <Section title="Your trades" href="/provider/apply/trades">
            {trades.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {trades.map((trade) => (
                  <Badge key={trade.id} tone="brand">
                    {trade.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <Empty>No trades chosen yet.</Empty>
            )}
          </Section>

          <Section title="About you" href="/provider/apply/about">
            {provider.bio ? (
              <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-navy-900">
                {provider.bio}
              </p>
            ) : (
              <Empty>Nothing written yet.</Empty>
            )}

            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <Line label="Experience">
                {provider.years_experience !== null ? (
                  <>
                    <span className="tabular font-mono">{provider.years_experience}</span> years
                  </>
                ) : (
                  "-"
                )}
              </Line>
              <Line label="Based in">{provider.base_city ?? "-"}</Line>
              <Line label="Will travel">
                <span className="tabular font-mono">{Number(provider.service_radius_km)}</span> km
              </Line>
              <Line label="Languages">
                {(profile?.spoken_languages ?? []).join(", ") || "-"}
              </Line>
            </dl>
          </Section>

          <Section title="Getting paid" href="/provider/apply/payout">
            {provider.momo_number && provider.momo_network ? (
              <p className="text-[0.9375rem] text-navy-900">
                <span className="tabular font-mono">
                  {formatPhoneForDisplay(provider.momo_number)}
                </span>
                <span className="text-copy-muted"> · {MOMO_NETWORK_LABELS[provider.momo_network]}</span>
              </p>
            ) : (
              <Empty>No payment number yet.</Empty>
            )}
          </Section>

          <Section title="Proof of identity" href="/provider/apply/documents">
            <p className="text-[0.9375rem] text-navy-900">
              Ghana Card{" "}
              <span className="tabular font-mono">{provider.ghana_card_number ?? "-"}</span>
            </p>

            <ul className="mt-2 space-y-1 text-sm">
              {REQUIRED_DOCS.map((spec) => (
                <li key={spec.type} className="flex items-center gap-2 text-copy">
                  <span
                    aria-hidden
                    className={
                      docTypes.has(spec.type)
                        ? "size-1.5 rounded-full bg-success-600"
                        : "size-1.5 rounded-full bg-hairline"
                    }
                  />
                  {docLabel(spec.type)}
                  <span className={docTypes.has(spec.type) ? "text-success-700" : "text-copy-muted"}>
                    {docTypes.has(spec.type) ? "uploaded" : "missing"}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </CardContent>
      </Card>

      <SubmitApplication ready={ready} />
    </div>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-azure-50 pb-5 last:border-0 last:pb-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-800 transition-colors hover:text-navy-900"
        >
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Link>
      </div>
      {children}
    </section>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-copy-muted">{label}</dt>
      <dd className="text-navy-900">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.9375rem] text-copy-muted">{children}</p>;
}
