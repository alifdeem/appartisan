import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatPhoneForDisplay } from "@/lib/phone";
import {
  countByVerificationStatus,
  listVerificationQueue,
  type ProviderWithProfile,
} from "@/lib/providers/queries";
import { cn, timeAgo } from "@/lib/utils";
import type { VerificationStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Verification queue" };

const TABS = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "suspended", label: "Suspended" },
  { key: "unsubmitted", label: "Not applied" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * The verification queue.
 *
 * This is the screen the client's own staff live in, so it is built as an
 * operational list rather than as a set of cards: one row per artisan, fixed
 * height, the same three facts in the same three places every time. A card grid
 * looks better in a screenshot and is slower to work through forty times a day.
 *
 * **Waiting time is the loudest thing in each row**, set in mono so the column
 * reads vertically. An admin scanning this queue is not asking "who is this",
 * they are asking "who has been waiting too long" — and an artisan who applied
 * on Monday going unreviewed until Thursday is how the supply side quietly
 * stops applying.
 *
 * The filter is a query parameter rather than client state, so a filtered view
 * is a link somebody can send to a colleague.
 */
export default async function VerificationQueuePage({
  searchParams,
}: PageProps<"/admin/verification">) {
  const params = await searchParams;
  const raw = typeof params.status === "string" ? params.status : "pending";
  const status: TabKey = TABS.some((tab) => tab.key === raw) ? (raw as TabKey) : "pending";

  const [providers, counts] = await Promise.all([
    listVerificationQueue(status),
    countByVerificationStatus(),
  ]);

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
          <h1 className="text-2xl font-semibold text-ink-900">Verification</h1>
          <p className="text-[0.9375rem] text-ink-600">
            {(counts.pending ?? 0) === 0
              ? "Nobody is waiting for review."
              : `${counts.pending} artisan${counts.pending === 1 ? "" : "s"} waiting for review.`}
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Filter by status">
        {TABS.map((tab) => {
          const count = counts[tab.key] ?? 0;
          const selected = status === tab.key;

          return (
            <Link
              key={tab.key}
              href={`/admin/verification?status=${tab.key}`}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium",
                "transition-colors duration-[var(--duration-fast)] ease-out-strong",
                selected
                  ? "bg-ink-900 text-ink-0"
                  : "border border-ink-300 bg-ink-0 text-ink-700 hover:bg-ink-50",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "tabular font-mono text-xs",
                  selected ? "text-ink-0/70" : "text-ink-400",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {providers.length === 0 ? (
        <div className="rounded-card border border-dashed border-ink-300 bg-ink-50 px-5 py-14 text-center">
          <p className="text-sm font-medium text-ink-800">
            {status === "pending" ? "Queue is clear" : "Nobody here"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
            {status === "pending"
              ? "Every application has been reviewed. New ones appear here as they come in."
              : "No artisans have this status right now."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-ink-200 overflow-hidden rounded-card border border-ink-200 bg-ink-0 shadow-sm">
          {providers.map((provider) => (
            <li key={provider.profile_id}>
              <QueueRow provider={provider} status={status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QueueRow({
  provider,
  status,
}: {
  provider: ProviderWithProfile;
  status: VerificationStatus;
}) {
  const name = provider.profile?.full_name ?? "Unknown artisan";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const waitingSince = provider.application_submitted_at;

  return (
    <Link
      href={`/admin/verification/${provider.profile_id}`}
      className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors duration-[var(--duration-instant)] hover:bg-ink-50"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-100 text-sm font-semibold text-ink-600">
        {initials || "?"}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium text-ink-900">{name}</span>
        <span className="tabular block truncate font-mono text-xs text-ink-500">
          {provider.profile?.phone ? formatPhoneForDisplay(provider.profile.phone) : "—"}
          {provider.base_city && <span className="font-sans"> · {provider.base_city}</span>}
        </span>
      </span>

      {status === "pending" && waitingSince ? (
        <span className="hidden shrink-0 items-center gap-1.5 text-sm text-ink-600 sm:flex">
          <Clock className="size-3.5 text-ink-400" aria-hidden />
          <span className="tabular font-mono">{timeAgo(waitingSince)}</span>
        </span>
      ) : (
        <span className="hidden shrink-0 sm:block">
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
        </span>
      )}

      <ArrowRight
        className="size-4 shrink-0 text-ink-300 transition-transform duration-[var(--duration-fast)] ease-out-strong group-hover:translate-x-0.5 group-hover:text-ink-500"
        aria-hidden
      />
    </Link>
  );
}
