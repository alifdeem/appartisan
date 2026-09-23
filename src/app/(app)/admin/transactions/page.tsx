import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/card";
import { Figure } from "@/components/admin/figure";
import { LedgerTable } from "@/components/admin/ledger-table";
import { listLedger } from "@/lib/admin/queries";
import { formatCedis } from "@/lib/money";

export const metadata: Metadata = { title: "Transactions" };

/**
 * Every movement of money, both directions.
 *
 * **The screen that was missing.** Money out only started working recently,
 * and until now a transfer that failed had nowhere to be seen: the overview
 * could say *one payout did not reach an artisan* and then had to admit there
 * was no page for it. This is that page.
 *
 * Charges and transfers interleave rather than splitting into two tables,
 * because the question is almost always about one job's money, and the answer
 * is the charge and the transfer read together.
 */
export default async function AdminTransactionsPage() {
  const { rows, totals } = await listLedger();
  /**
   * Only a failed *transfer* is trouble.
   *
   * The first version summed failed charges and failed transfers into one
   * "Failed" figure, which read GHS 199.20 above a caption saying GHS 0.00
   * never reached an artisan. They are not the same event and should never
   * share a number. A charge that fails is routine - a declined prompt, no
   * funds, a mistyped PIN - and the client simply pays again; nothing is lost
   * and nobody needs to act. A transfer that fails is money a client already
   * paid that never arrived, and somebody has to fix it.
   */
  const trouble = totals.failedOut > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-space text-title font-bold text-navy-900">Transactions</h1>
        <p className="mt-1 text-note text-copy-muted">
          Every charge collected and every transfer sent, newest first.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent>
            <Figure label="Collected" value={formatCedis(totals.in)} sub="Charges that cleared" />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Figure label="Paid out" value={formatCedis(totals.out)} sub="Transfers that landed" />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Figure
              label="Queued to send"
              value={formatCedis(totals.pendingOut)}
              tone={totals.pendingOut > 0 ? "warning" : "muted"}
              sub="Owed, not yet sent"
            />
          </CardContent>
        </Card>
        <Card className={trouble ? "border-danger-500/35" : undefined}>
          <CardContent>
            <Figure
              label="Failed transfers"
              value={formatCedis(totals.failedOut)}
              tone={trouble ? "danger" : "muted"}
              sub={
                trouble
                  ? "Never reached an artisan"
                  : totals.failedIn > 0
                    ? `All sent. ${formatCedis(totals.failedIn)} of charges declined.`
                    : "Everything has landed"
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
          <CardDescription>In is a client paying us. Out is us paying an artisan.</CardDescription>
        </CardHeader>
        <CardContent className="justify-start px-1.5 py-1.5">
          <LedgerTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
