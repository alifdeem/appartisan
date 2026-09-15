import { jobStatus } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";
import type { JobEventRow } from "@/lib/supabase/types";

/**
 * What has happened to this job, newest last.
 *
 * Drawn straight from `job_events`, which is written by a trigger and by
 * nothing else — so this is not a narrative the application assembles, it is
 * the audit log itself. That distinction is the point of the table (PLAN.md §6):
 * when a dispute arrives six weeks later, the screen the client saw and the
 * record support reads are the same rows.
 *
 * Only the client-facing label is shown. `to_status` is the state machine's
 * word; `jobStatus()` is the client's.
 */
export function JobTimeline({ events }: { events: JobEventRow[] }) {
  if (events.length === 0) return null;

  return (
    <ol className="space-y-0">
      {events.map((event, index) => {
        const presentation = jobStatus(event.to_status);
        const last = index === events.length - 1;

        return (
          <li key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  last ? "bg-brand-600 ring-4 ring-brand-600/15" : "bg-ink-300",
                )}
                aria-hidden
              />
              {!last && <span className="w-px flex-1 bg-ink-200" aria-hidden />}
            </div>

            <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-4")}>
              <p
                className={cn(
                  "text-sm leading-snug",
                  last ? "font-medium text-ink-900" : "text-ink-700",
                )}
              >
                {presentation.label}
              </p>

              {event.reason && (
                <p className="mt-0.5 text-sm leading-snug text-ink-600">“{event.reason}”</p>
              )}

              <time
                dateTime={event.created_at}
                className="tabular mt-0.5 block font-mono text-xs text-ink-400"
              >
                {new Date(event.created_at).toLocaleString("en-GH", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
