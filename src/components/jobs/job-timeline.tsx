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
 *
 * The last entry is the one that is lit: on a running job it is the present
 * tense, and on a finished one it is how the story ended. Everything above it
 * is history and is set as history — smaller dots, a hairline rail, muted type.
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
                  "mt-1.5 shrink-0 rounded-full",
                  last
                    ? "size-2.5 bg-azure-500 ring-4 ring-azure-500/15"
                    : "size-2 bg-hairline",
                )}
                aria-hidden
              />
              {!last && <span className="w-px flex-1 bg-hairline" aria-hidden />}
            </div>

            <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-4")}>
              <p
                className={cn(
                  "text-note leading-snug",
                  last ? "font-bold text-navy-900" : "text-copy-muted",
                )}
              >
                {presentation.label}
              </p>

              {event.reason && (
                <p className="mt-0.5 text-note leading-snug text-copy-muted italic">
                  &ldquo;{event.reason}&rdquo;
                </p>
              )}

              <time
                dateTime={event.created_at}
                className="tabular mt-0.5 block font-mono text-2xs text-copy-muted/80"
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
