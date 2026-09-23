import { CategoryIcon } from "@/components/marketplace/category-icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/table";
import { stageName } from "@/lib/admin/queries";
import { formatCedis } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { LiveJobRow } from "@/lib/admin/queries";

/**
 * Every running job, oldest movement first.
 *
 * **This is the part the console was missing.** The rest of the overview is
 * aggregate: counts, shares, totals. Aggregates tell an operator that six jobs
 * are waiting on a deposit and then leave them to go and find out which. This
 * names them, and puts the one that has not moved in two days at the top.
 *
 * **Stuck is computed, not decorated.** A job idle beyond the threshold for
 * its stage gets an amber age and a marker. Those thresholds are judgement,
 * so they are stated in one place rather than sprinkled through the markup.
 */

/**
 * How long a stage may sit before it is worth looking at, in hours.
 *
 * Short where a person is actively holding something up and long where the
 * wait is legitimately human: a client sleeping on a deposit overnight is
 * normal, an artisan not answering an offer for an hour is not.
 */
const STUCK_AFTER_HOURS: Partial<Record<string, number>> = {
  posted: 1,
  matching: 1,
  offer_sent: 1,
  quote_pending: 6,
  quote_sent: 24,
  awaiting_deposit: 24,
  deposit_paid: 3,
  en_route: 3,
  arrived: 2,
  in_progress: 12,
  awaiting_signoff: 24,
  awaiting_balance: 24,
};

/**
 * How long a job has sat, as a column value.
 *
 * `timeAgo` writes prose ("3 hours ago"), which is right in a sentence and
 * wrong in a table: the column is scanned vertically and compared, so it wants
 * a short, mono, same-shape token. "4m" under "3h" under "2d" reads as a
 * ranking; "4 minutes ago" under "3 hours ago" does not.
 */
function idleFor(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function isStuck(row: LiveJobRow): boolean {
  const limit = STUCK_AFTER_HOURS[row.status];
  if (!limit) return false;
  return Date.now() - new Date(row.movedAt).getTime() > limit * 3_600_000;
}

export function LiveBoard({
  rows,
  mode = "live",
}: {
  rows: LiveJobRow[] | null;
  /**
   * `recent` is the fallback set the board shows when nothing is running.
   * Those jobs are finished, so none of them can be stuck and none of them is
   * "idle" - the column means something different and says so.
   */
  mode?: "live" | "recent" | "mixed";
}) {
  // `null` means the read failed. Saying "nothing is running" would be a
  // confident wrong answer, and an operations console is exactly where that
  // does damage.
  if (rows === null) {
    return (
      <p
        role="alert"
        className="rounded-[0.875rem] border border-dashed border-danger-500/40 bg-danger-50/50 px-4 py-10 text-center text-note text-danger-700"
      >
        The board could not be loaded. Counts elsewhere on this page are still accurate.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-[0.875rem] border border-dashed border-hairline bg-azure-50/40 px-4 py-10 text-center text-note text-copy-muted">
        Nothing here yet.
      </p>
    );
  }

  return (
    /**
     * `table-fixed` with declared column widths.
     *
     * Left to size itself, the table takes its width from its widest content:
     * a long stage name and a full artisan name together pushed it past the
     * card, and the last column ("Idle") was clipped off the right edge with
     * no scrollbar in sight to suggest it was there. Auto layout also means
     * the columns shift every time the data does, so two screenshots of the
     * same board never line up. Fixed widths cost a truncation and buy a table
     * that is the same shape on every render.
     */
    <Table className="table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {/**
           * Widths are declared per breakpoint and each set sums to 100.
           *
           * `table-fixed` is what stops the table outgrowing its card, but it
           * cuts both ways: a fixed column does not shrink to fit, it lets its
           * content spill over the column beside it. One set of percentages
           * tuned for a laptop therefore turns into overlapping text on a
           * phone. So columns drop out as the viewport narrows and the
           * survivors take the freed space.
           *
           * After the job itself, Stage is the column an operator reads, so it
           * keeps its width at every size.
           */}
          <TableHead className="w-[80%] sm:w-[34%] md:w-[30%] lg:w-[26%]">Job</TableHead>
          {/* Below `sm` the stage moves into the Job cell as a second line
              rather than fighting for a column of its own. Three columns at
              390px left it reading "Waiting o...", which is worse than not
              showing it: the stage is the reason to look at the row. */}
          <TableHead className="hidden sm:table-cell sm:w-[26%] md:w-[24%]">Stage</TableHead>
          <TableHead className="hidden md:table-cell md:w-[16%] lg:w-[14%]">Client</TableHead>
          <TableHead className="hidden lg:table-cell lg:w-[15%]">Artisan</TableHead>
          <TableHead className="hidden text-right sm:table-cell sm:w-[30%] md:w-[20%] lg:w-[13%]">
            Value
          </TableHead>
          <TableHead className="w-[20%] pr-4 text-right sm:w-[10%] lg:w-[8%]">
            {mode === "live" ? "Idle" : mode === "recent" ? "Closed" : "Last move"}
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => {
          // A finished job cannot be stuck, so the fallback set never flags one.
          // `mixed` keeps the flag: only live statuses have a threshold, so a
          // finished job in the same list can never trip it.
          const stuck = mode !== "recent" && isStuck(row);

          return (
            <TableRow key={row.id}>
              {/* Not a link. There is no per-job admin screen, and pointing
                  every row at /admin/matching would send an operator somewhere
                  that cannot act on three quarters of them. The board informs;
                  the queue tiles above are what act. */}
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[0.625rem] bg-azure-50 text-navy-800">
                    <CategoryIcon name={row.icon ?? "wrench"} className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-note font-semibold text-navy-900">
                      {row.trade ?? "Job"}
                    </span>

                    {/* The reference is an identifier and the stage is the
                        state. On a wide row both fit, in their own places. On
                        a phone there is room for one, and the state is the one
                        worth having. */}
                    <span className="tabular hidden font-mono text-2xs text-copy-muted sm:block">
                      {row.reference}
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-2xs text-copy-muted sm:hidden">
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          stuck ? "bg-warning-500" : "bg-azure-500",
                        )}
                      />
                      {stageName(row.status)}
                    </span>
                  </span>
                </div>
              </TableCell>

              <TableCell className="hidden sm:table-cell">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      stuck ? "bg-warning-500" : "bg-azure-500",
                    )}
                  />
                  <span className="truncate text-note text-copy">{stageName(row.status)}</span>
                </span>
              </TableCell>

              <TableCell className="hidden truncate text-note text-copy-muted md:table-cell">
                {row.clientName ?? "Unknown"}
              </TableCell>

              <TableCell className="hidden truncate text-note text-copy-muted lg:table-cell">
                {row.providerName ?? <span className="text-copy-muted/70">not assigned</span>}
              </TableCell>

              <TableCell className="tabular hidden text-right font-mono text-note text-navy-900 sm:table-cell">
                {row.value === null ? (
                  <span className="text-copy-muted/70">no price yet</span>
                ) : (
                  formatCedis(row.value)
                )}
              </TableCell>

              <TableCell
                className={cn(
                  "tabular pr-4 text-right font-mono text-note",
                  stuck ? "font-semibold text-warning-700" : "text-copy-muted",
                )}
              >
                {idleFor(row.movedAt)}
                {stuck && (
                  <span className="sr-only"> (longer than expected for this stage)</span>
                )}
              </TableCell>

            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
