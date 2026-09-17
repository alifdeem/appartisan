"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Phone } from "lucide-react";
import { toast } from "sonner";

import { assignJobAction } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { formatPhoneForDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { AssignableProvider } from "@/lib/jobs/matching";

/**
 * Hand a stalled job to an artisan.
 *
 * The order of operations on this screen is the phone call first and the
 * assignment second — an admin who assigns before calling has committed an
 * artisan who does not know they have a job. So each row leads with a
 * tap-to-call number, and the assign button only lights once a row is selected,
 * which is the point at which the admin has had the conversation.
 *
 * Offline artisans are listed, not hidden, and labelled as offline. The matcher
 * has already tried everyone who was online and in radius; the whole value of
 * this screen is reaching the people it could not.
 */
export function AssignJob({
  jobId,
  candidates,
}: {
  jobId: string;
  candidates: AssignableProvider[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState<string | null>(null);

  function assign() {
    if (!selected || pending) return;

    startTransition(async () => {
      const result = await assignJobAction(jobId, selected);

      if (!result.ok) {
        toast.error(result.error ?? "Could not assign that job.");
        return;
      }

      toast.success("Assigned. The artisan can now send a price.");
      setSelected(null);
      router.refresh();
    });
  }

  if (candidates.length === 0) {
    return (
      <p className="rounded-field border border-dashed border-ink-300 bg-ink-50 px-4 py-6 text-center text-sm text-ink-500">
        No approved artisans in this trade yet. This one needs supply before it needs an admin.
      </p>
    );
  }

  return (
    <div className="space-y-3 border-t border-ink-100 pt-4">
      <h3 className="text-sm font-semibold text-ink-800">
        Approved artisans in this trade
        <span className="tabular ml-1.5 font-mono text-xs font-normal text-ink-400">
          {candidates.length}
        </span>
      </h3>

      <ul className="max-h-72 space-y-1.5 overflow-y-auto">
        {candidates.map((candidate) => {
          const on = selected === candidate.profile_id;
          const online = candidate.availability === "online";
          const busy = candidate.availability === "on_job";

          return (
            <li key={candidate.profile_id}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-field border p-2.5",
                  "transition-[border-color,background-color] duration-[var(--duration-fast)] ease-out-strong",
                  on ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-ink-200 bg-ink-0",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected(on ? null : candidate.profile_id)}
                  aria-pressed={on}
                  disabled={busy}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-50"
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      on ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600",
                    )}
                  >
                    {on ? (
                      <Check className="size-4" strokeWidth={3} aria-hidden />
                    ) : (
                      (candidate.profile?.full_name ?? "?")
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">
                      {candidate.profile?.full_name ?? "Artisan"}
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {busy ? "On a job" : online ? "Online" : "Offline"}
                      {candidate.base_city && ` · ${candidate.base_city}`}
                      {candidate.jobs_completed > 0 && ` · ${candidate.jobs_completed} jobs`}
                    </span>
                  </span>
                </button>

                {candidate.profile?.phone && (
                  <a
                    href={`tel:${candidate.profile.phone}`}
                    title={`Call ${candidate.profile.full_name}`}
                    className="grid size-9 shrink-0 place-items-center rounded-field border border-ink-300 bg-ink-0 text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
                  >
                    <Phone className="size-4" aria-hidden />
                    <span className="sr-only">
                      Call {formatPhoneForDisplay(candidate.profile.phone)}
                    </span>
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Button type="button" loading={pending} disabled={!selected} onClick={assign}>
        Assign this job
      </Button>
    </div>
  );
}
