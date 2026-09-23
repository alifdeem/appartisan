import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/table";
import { formatCedis } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/admin/queries";

/**
 * Money in and money out, on one timeline.
 *
 * **Direction is carried by an icon and a sign, never by colour alone.** Green
 * for in and red for out is the obvious move and it fails for the eight
 * percent of men with a red-green deficiency, who are well represented among
 * the people who run operations consoles. The arrow and the leading sign do
 * the work; colour reinforces.
 *
 * **A failed row states why.** `failure_reason` is the difference between
 * "this went wrong" and "this went wrong because the artisan's Mobile Money
 * number is wrong", and only one of those tells somebody what to do next.
 */

const STATUS_TONE: Record<string, string> = {
  succeeded: "bg-success-50 text-success-700",
  paid: "bg-success-50 text-success-700",
  pending: "bg-warning-50 text-warning-700",
  processing: "bg-warning-50 text-warning-700",
  failed: "bg-danger-50 text-danger-700",
  refunded: "bg-azure-50 text-copy-muted",
};

const KIND_LABEL: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance",
  payout: "Payout",
};

export function LedgerTable({ rows }: { rows: LedgerEntry[] | null }) {
  if (rows === null) {
    return (
      <p
        role="alert"
        className="rounded-[0.875rem] border border-dashed border-danger-500/40 bg-danger-50/50 px-4 py-10 text-center text-note text-danger-700"
      >
        The ledger could not be loaded.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-[0.875rem] border border-dashed border-hairline bg-azure-50/40 px-4 py-10 text-center text-note text-copy-muted">
        No money has moved yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[42%] sm:w-[30%]">Movement</TableHead>
          <TableHead className="hidden sm:table-cell sm:w-[22%]">Job</TableHead>
          <TableHead className="hidden md:table-cell md:w-[18%]">Counterparty</TableHead>
          <TableHead className="w-[16%]">Status</TableHead>
          <TableHead className="w-[26%] pr-4 text-right sm:w-[16%]">Amount</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => {
          const out = row.direction === "out";
          const Icon = out ? ArrowUpRight : ArrowDownLeft;

          return (
            <TableRow key={`${row.direction}-${row.id}`}>
              <TableCell>
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-[0.625rem]",
                      out ? "bg-navy-800/8 text-navy-800" : "bg-success-50 text-success-700",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-note font-semibold text-navy-900">
                      {KIND_LABEL[row.kind] ?? row.kind}
                      <span className="sr-only">{out ? " paid out" : " collected"}</span>
                    </span>
                    <span className="tabular block truncate font-mono text-2xs text-copy-muted">
                      {new Date(row.at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </span>
              </TableCell>

              <TableCell className="hidden sm:table-cell">
                <span className="tabular font-mono text-2xs text-copy-muted">
                  {row.jobReference ?? "not linked"}
                </span>
              </TableCell>

              <TableCell className="hidden max-w-0 truncate text-note text-copy-muted md:table-cell">
                {row.counterparty ?? "Unknown"}
              </TableCell>

              <TableCell>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold whitespace-nowrap",
                    STATUS_TONE[row.status] ?? "bg-azure-50 text-copy-muted",
                  )}
                >
                  {row.status}
                </span>
                {row.failureReason && (
                  <span className="mt-1 block max-w-[16rem] text-2xs leading-snug text-danger-700">
                    {row.failureReason}
                  </span>
                )}
              </TableCell>

              <TableCell
                className={cn(
                  "tabular pr-4 text-right font-mono text-note font-semibold",
                  out ? "text-copy" : "text-navy-900",
                )}
              >
                {out ? "-" : "+"}
                {formatCedis(row.amount).replace("GHS ", "")}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
