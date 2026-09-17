"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Hammer, Package, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { saveQuoteAction, sendQuoteAction } from "@/app/(app)/provider/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { QuoteSummary } from "@/components/marketplace/quote-summary";
import { formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { QuoteContext } from "@/lib/jobs/matching";

/**
 * The itemised quote.
 *
 * PLAN.md §2 commits to a structured builder with labour and materials as
 * separate lines rather than a single "price" box, and that structure is the
 * product: an itemised docket is what lets a client decline a number without
 * it being a negotiation, and what makes the docket in DESIGN.md §2 possible
 * at all.
 *
 * Four decisions:
 *
 *  • **The totals update as you type, and are recomputed server-side anyway.**
 *    The live figures exist so the artisan can see the client-facing number
 *    before committing to it — PLAN.md §4's doorstep problem. `save_quote`
 *    derives every stored figure from the line items, so this preview is
 *    advisory and cannot become the price.
 *
 *  • **Transport is shown but not editable.** It comes from the admin's band
 *    table and passes to the artisan in full. Letting an artisan set their own
 *    travel fee would make the one number the platform controls negotiable.
 *
 *  • **Amounts are typed on a numeric keypad, and `quantity` defaults to 1.**
 *    Most labour lines are one of a thing. Defaulting to 1 removes a field from
 *    the common case without hiding it from the uncommon one.
 *
 *  • **Saving is not a separate step the artisan has to remember.** Sending
 *    saves first, in one tap, and a draft is only persisted when they ask for
 *    one. A "save then send" pair is two chances to leave a quote unsent.
 */

type Kind = "labour" | "material";

interface Line {
  /** Stable across re-orders and removals, so React keys never collide. */
  key: string;
  kind: Kind;
  description: string;
  quantity: string;
  unitPrice: string;
}

function blank(kind: Kind): Line {
  return { key: crypto.randomUUID(), kind, description: "", quantity: "1", unitPrice: "" };
}

/** Empty string, `-` and half-typed decimals must read as 0, never NaN. */
function num(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function QuoteBuilder({
  jobId,
  context,
  existing,
}: {
  jobId: string;
  context: QuoteContext;
  existing: {
    id: string;
    notes: string | null;
    items: { kind: Kind; description: string; quantity: string; unitPrice: string }[];
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [lines, setLines] = React.useState<Line[]>(() =>
    existing && existing.items.length > 0
      ? existing.items.map((item) => ({ ...item, key: crypto.randomUUID() }))
      : [blank("labour")],
  );
  const [notes, setNotes] = React.useState(existing?.notes ?? "");

  // Derived during render rather than held in state. A running total kept in an
  // effect is a total that is one keystroke stale exactly when somebody is
  // watching it change.
  const subtotal = lines.reduce((sum, line) => sum + num(line.quantity) * num(line.unitPrice), 0);
  const complete = lines.filter((line) => line.description.trim() !== "" && num(line.unitPrice) > 0);
  const ready = complete.length > 0 && subtotal > 0;

  function update(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function remove(key: string) {
    setLines((current) => (current.length === 1 ? current : current.filter((l) => l.key !== key)));
  }

  function send() {
    if (!ready || pending) return;
    setError(null);

    startTransition(async () => {
      const saved = await saveQuoteAction({
        jobId,
        items: complete.map((line) => ({
          kind: line.kind,
          description: line.description.trim(),
          quantity: num(line.quantity) || 1,
          unitPrice: num(line.unitPrice),
        })),
        notes: notes.trim() || undefined,
      });

      if (!saved.ok || !saved.quoteId) {
        setError(saved.error ?? "Could not save the quote.");
        return;
      }

      const sent = await sendQuoteAction(saved.quoteId);

      if (!sent.ok) {
        // The draft survived, so nothing the artisan typed is lost — say so,
        // because "could not send" otherwise reads as "start again".
        setError(sent.error ?? "The quote was saved but could not be sent.");
        router.refresh();
        return;
      }

      toast.success("Price sent. The client decides next.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-ink-900">Build your price</h2>
          <p className="max-w-prose text-sm leading-relaxed text-ink-600">
            Break it down the way you would explain it. Clients approve itemised prices far more
            often than a single figure, and they cannot haggle a line they understand.
          </p>
        </div>

        <ul className="space-y-2.5">
          {lines.map((line, index) => (
            <li
              key={line.key}
              className="rounded-card border border-ink-200 bg-ink-25 p-3 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2 pb-2.5">
                {/* Two options, so a segmented control rather than a select —
                    one tap instead of tap, scroll, tap. */}
                <div
                  className="inline-flex rounded-field border border-ink-300 bg-ink-0 p-0.5"
                  role="group"
                  aria-label="Line type"
                >
                  {(["labour", "material"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => update(line.key, { kind })}
                      aria-pressed={line.kind === kind}
                      className={cn(
                        "inline-flex min-h-8 items-center gap-1.5 rounded-[0.4rem] px-2.5 text-xs font-medium",
                        "transition-colors duration-[var(--duration-instant)] ease-out-strong",
                        line.kind === kind
                          ? "bg-brand-700 text-white"
                          : "text-ink-600 hover:text-ink-900",
                      )}
                    >
                      {kind === "labour" ? (
                        <Hammer className="size-3.5" aria-hidden />
                      ) : (
                        <Package className="size-3.5" aria-hidden />
                      )}
                      {kind === "labour" ? "Labour" : "Materials"}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="tabular font-mono text-sm font-medium text-ink-900">
                    {formatAmount(num(line.quantity) * num(line.unitPrice))}
                  </span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(line.key)}
                      title="Remove line"
                      className="grid size-8 place-items-center rounded-field text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only">Remove line {index + 1}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  value={line.description}
                  onChange={(event) => update(line.key, { description: event.target.value })}
                  maxLength={200}
                  placeholder={
                    line.kind === "labour"
                      ? "Trace fault and replace two socket outlets"
                      : "Double socket outlet"
                  }
                  aria-label={`Line ${index + 1} description`}
                />

                <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                  <Input
                    value={line.quantity}
                    onChange={(event) => update(line.key, { quantity: event.target.value })}
                    inputMode="decimal"
                    placeholder="1"
                    className="tabular text-center font-mono"
                    aria-label={`Line ${index + 1} quantity`}
                  />
                  <Input
                    value={line.unitPrice}
                    onChange={(event) => update(line.key, { unitPrice: event.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="tabular font-mono"
                    aria-label={`Line ${index + 1} unit price`}
                    leading={<span className="text-xs font-medium">GHS</span>}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setLines((c) => [...c, blank("labour")])}>
            <Plus />
            Labour
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setLines((c) => [...c, blank("material")])}>
            <Plus />
            Materials
          </Button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="quoteNotes" className="block text-sm font-medium text-ink-800">
            Anything the client should know
            <span className="ml-1.5 text-xs font-normal text-ink-400">optional</span>
          </label>
          <Textarea
            id="quoteNotes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Price includes testing the whole kitchen ring. I can come Thursday morning."
          />
        </div>

        {/* The two numbers, live. This is the part of the screen PLAN.md §4
            actually asks for. */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-800">What this means</h3>
          <QuoteSummary
            subtotal={subtotal}
            transportFee={context.transportFee}
            commissionPct={context.commissionPct}
          />
          {context.distanceKm !== null && (
            <p className="text-xs text-ink-500">
              Transport is set by distance band —{" "}
              <span className="tabular font-mono">{context.distanceKm.toFixed(1)} km</span> puts
              this job at {formatAmount(context.transportFee)}, and it is paid to you in full.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="animate-fade-in text-sm text-danger-600">
            {error}
          </p>
        )}

        <Button type="button" size="lg" block loading={pending} disabled={!ready} onClick={send}>
          <Send />
          Send this price to the client
        </Button>

        <p className="text-center text-xs leading-relaxed text-ink-500">
          They approve it before you travel. If they decline, the job goes back out and you keep
          your place in the queue for the next one.
        </p>
      </CardContent>
    </Card>
  );
}
