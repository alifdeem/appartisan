import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";

import { DocumentViewer } from "@/app/(app)/admin/verification/[providerId]/_components/document-viewer";
import { ReviewDecision } from "@/app/(app)/admin/verification/[providerId]/_components/review-decision";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MOMO_NETWORK_LABELS, formatPhoneForDisplay } from "@/lib/phone";
import {
  getProviderForReview,
  listProviderCategories,
  listProviderDocuments,
  listVerificationReviews,
  signProviderDocuments,
} from "@/lib/providers/queries";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Review artisan" };

/**
 * One application, everything about it, and the decision.
 *
 * Ordered the way the review is actually conducted, which is not the order the
 * artisan filled it in. PLAN.md §2 is explicit that the judgement happens on a
 * phone call, so the phone number is at the top and is a `tel:` link — the admin
 * taps it, has the conversation, and comes back to this screen to record what
 * was said.
 *
 * The documents sit directly above the decision because the decision is made
 * while looking at them. Everything the artisan typed sits in a column beside,
 * which is reference material rather than evidence.
 */
export default async function ReviewProviderPage({
  params,
}: PageProps<"/admin/verification/[providerId]">) {
  const { providerId } = await params;

  const provider = await getProviderForReview(providerId);
  if (!provider) notFound();

  const [trades, documents, reviews] = await Promise.all([
    listProviderCategories(providerId),
    listProviderDocuments(providerId),
    listVerificationReviews(providerId),
  ]);

  const signed = await signProviderDocuments(documents);
  const name = provider.profile?.full_name ?? "Unknown artisan";
  const phone = provider.profile?.phone ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/verification"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Verification queue
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold text-ink-900">{name}</h1>
              <Badge
                tone={
                  provider.verification_status === "approved"
                    ? "success"
                    : provider.verification_status === "pending"
                      ? "info"
                      : provider.verification_status === "unsubmitted"
                        ? "neutral"
                        : "danger"
                }
              >
                {provider.verification_status}
              </Badge>
            </div>

            <p className="text-[0.9375rem] text-ink-600">
              {provider.application_submitted_at
                ? `Applied ${timeAgo(provider.application_submitted_at)}`
                : "Has not submitted an application yet."}
            </p>
          </div>

          {/* The vetting call is the review. Making the number a tap rather than
              something to copy out is most of what makes this screen usable on
              a phone. */}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-field border border-ink-300 bg-ink-0 px-4 text-[0.9375rem] font-medium text-ink-800 shadow-xs transition-[background-color,border-color,transform] duration-[var(--duration-instant)] ease-out-strong hover:border-ink-400 hover:bg-ink-50 active:scale-[0.98]"
            >
              <Phone className="size-4" aria-hidden />
              <span className="tabular font-mono">{formatPhoneForDisplay(phone)}</span>
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold text-ink-900">Documents</h2>
                <p className="tabular font-mono text-sm text-ink-600">
                  {provider.ghana_card_number ?? "no card number"}
                </p>
              </div>

              <DocumentViewer documents={signed} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-base font-semibold text-ink-900">Record a decision</h2>
              <ReviewDecision
                providerId={providerId}
                currentStatus={provider.verification_status}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-sm font-semibold text-ink-800">What they told us</h2>

              {provider.bio ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-700">
                  {provider.bio}
                </p>
              ) : (
                <p className="text-sm text-ink-400">No description written.</p>
              )}

              {trades.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {trades.map((trade) => (
                    <Badge key={trade.id} tone="brand">
                      {trade.name}
                    </Badge>
                  ))}
                </div>
              )}

              <dl className="space-y-2 border-t border-ink-100 pt-3 text-sm">
                <Row label="Experience">
                  {provider.years_experience !== null ? (
                    <>
                      <span className="tabular font-mono">{provider.years_experience}</span> years
                    </>
                  ) : (
                    "—"
                  )}
                </Row>
                <Row label="Based in">{provider.base_city ?? "—"}</Row>
                <Row label="Travels">
                  <span className="tabular font-mono">{Number(provider.service_radius_km)}</span> km
                </Row>
                <Row label="Languages">
                  {(provider.profile?.spoken_languages ?? []).join(", ") || "—"}
                </Row>
                <Row label="Paid on">
                  {provider.momo_number && provider.momo_network ? (
                    <>
                      <span className="tabular font-mono">
                        {formatPhoneForDisplay(provider.momo_number)}
                      </span>
                      <span className="text-ink-500">
                        {" "}
                        · {MOMO_NETWORK_LABELS[provider.momo_network]}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </Row>
              </dl>
            </CardContent>
          </Card>

          {reviews.length > 0 && (
            <Card>
              <CardContent className="space-y-3">
                <h2 className="text-sm font-semibold text-ink-800">Previous decisions</h2>

                <ol className="space-y-3">
                  {reviews.map((review) => (
                    <li key={review.id} className="space-y-1 border-l-2 border-ink-200 pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            review.decision === "approved"
                              ? "success"
                              : review.decision === "suspended"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {review.decision}
                        </Badge>
                        <span className="text-xs text-ink-500">
                          {review.admin?.full_name ?? "Admin"} · {timeAgo(review.reviewed_at)}
                        </span>
                      </div>

                      {review.call_notes && (
                        <p className="text-sm leading-relaxed text-ink-700">{review.call_notes}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="text-right text-ink-800">{children}</dd>
    </div>
  );
}
