import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ImageOff, ShieldAlert } from "lucide-react";

import { DisputeDecision } from "./_components/dispute-decision";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listDisputes } from "@/lib/admin/queries";
import { formatPhoneForDisplay } from "@/lib/phone";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Disputes" };

const DECIDED: string[] = ["resolved", "rejected"];

const TONE = {
  open: "danger",
  investigating: "warning",
  resolved: "success",
  rejected: "neutral",
} as const;

/**
 * The disputes queue.
 *
 * Ordered as a queue rather than a feed — open first, then oldest — because
 * the thing that matters is which one has been waiting longest, not which one
 * arrived last. Resolved disputes stay on the list rather than disappearing:
 * when the same artisan shows up twice, the previous outcome is the context an
 * admin needs before making the second call.
 */
export default async function DisputesPage() {
  const disputes = await listDisputes();
  const live = disputes.filter((d) => !DECIDED.includes(d.status));

  return (
    <div className="space-y-6">

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-navy-900">Disputes</h1>
        <p className="text-[0.9375rem] text-copy-muted">
          {live.length === 0
            ? "Nothing outstanding."
            : `${live.length} waiting on a decision.`}
        </p>
      </div>

      {disputes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <ShieldAlert className="mx-auto size-6 text-hairline" aria-hidden />
            <p className="mt-2 text-sm font-medium text-navy-900">No disputes raised</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-copy-muted">
              Clients and artisans can both report a problem on a finished job.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {disputes.map((dispute) => (
            <li key={dispute.id}>
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[0.9375rem] font-medium text-navy-900">
                          {dispute.reason}
                        </h2>
                        <Badge tone={TONE[dispute.status]}>{dispute.status}</Badge>
                      </div>
                      <p className="tabular font-mono text-sm text-copy-muted">
                        {dispute.job?.reference ?? "job removed"} · raised {timeAgo(dispute.created_at)}
                      </p>
                      {dispute.raiser && (
                        <p className="text-sm text-copy-muted">
                          {dispute.raiser.full_name}{" "}
                          <span className="text-copy-muted">({dispute.raiser.role})</span> ·{" "}
                          <span className="tabular font-mono">
                            {formatPhoneForDisplay(dispute.raiser.phone)}
                          </span>
                        </p>
                      )}
                    </div>

                    {dispute.job && (
                      <Link
                        href={`/client/jobs/${dispute.job.id}`}
                        className="shrink-0 text-sm text-copy-muted underline-offset-4 transition-colors hover:text-navy-900 hover:underline"
                      >
                        View job
                      </Link>
                    )}
                  </div>

                  {dispute.detail && (
                    <p className="rounded-field bg-canvas px-3 py-2 text-sm text-copy">
                      {dispute.detail}
                    </p>
                  )}

                  {dispute.evidence.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.08em] text-copy-muted uppercase">
                        Evidence
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {dispute.evidence.map(({ path, url }) =>
                          url ? (
                            <a
                              key={path}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="relative size-20 overflow-hidden rounded-field border border-hairline transition-colors hover:border-copy-muted"
                            >
                              <Image src={url} alt="" fill sizes="80px" className="object-cover" />
                            </a>
                          ) : (
                            <span
                              key={path}
                              className="img-slot grid size-20 place-items-center rounded-field text-[0.625rem] text-copy-muted"
                            >
                              <ImageOff className="size-4" aria-hidden />
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {dispute.resolution ? (
                    <div className="border-t border-hairline pt-3">
                      <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.08em] text-copy-muted uppercase">
                        Decision
                      </p>
                      <p className="mt-0.5 text-sm text-copy">{dispute.resolution}</p>
                    </div>
                  ) : (
                    <DisputeDecision disputeId={dispute.id} />
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
