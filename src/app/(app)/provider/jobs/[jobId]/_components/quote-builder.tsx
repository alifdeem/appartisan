"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Hammer, Package, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { callAction } from "@/lib/action-call";

import { saveQuoteAction, sendQuoteAction } from "@/app/(app)/provider/actions";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/mobile/field-label";
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
 *
 * ---
 *
 * **On the controls.** The redesign's note about `ui/input.tsx` is that it
 * stays for dense grids where a boxed control is correct, and this is the
 * canonical dense grid — three fields to a line, several lines, all being
 * compared. That judgement still holds, so these are boxed rather than the
 * airy `PanelInput` used on one-question screens.
 *
 * What did not survive is the *warm* version of boxed. `Input` fills with
 * `ink-0` and focuses to a **green** ring, and a green ring is the loudest
 * possible wrong note on a navy screen. The skin below is the same control in
 * the cool palette, kept local because the quote builder is the only dense form
 * in the redesign — `ui/input.tsx` is left exactly as the admin console needs
 * it rather than being forked for one caller.
 */

const lineControl = [
  "w-full min-h-11 rounded-[0.75rem] border border-hairline bg-white px-3 py-2.5",
  "text-ui text-navy-900 placeholder:text-copy-muted/60",
  "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-out-strong",
  "hover:border-azure-300",
  "focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15 focus:outline-none",
].join(" ");

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
      const saved = await callAction(() =>
        saveQuoteAction({
          jobId,
          items: complete.map((line) => ({
            kind: line.kind,
            description: line.description.trim(),
            quantity: num(line.quantity) || 1,
            unitPrice: num(line.unitPrice),
          })),
          notes: notes.trim() || undefined,
        }),
      );

      const quoteId = "quoteId" in saved ? saved.quoteId : undefined;
      if (!saved.ok || !quoteId) {
        setError(saved.error ?? "Could not save the quote.");
        return;
      }

      const sent = await callAction(() => sendQuoteAction(quoteId));

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
    <section className="space-y-5 rounded-[1.5rem] border border-hairline bg-white p-5 shadow-[var(--shadow-float)]">
      <div className="space-y-1.5">
        <h2 className="font-space text-lede font-bold text-navy-900">Build your price</h2>
        <p className="text-note leading-relaxed text-copy-muted">
          Break it down the way you would explain it. Clients approve itemised prices far more
          often than a single figure, and they cannot haggle a line they understand.
        </p>
      </div>

      <ul className="space-y-2.5">
        {lines.map((line, index) => (
          <li key={line.key} className="rounded-[1.25rem] bg-canvas p-3">
            <div className="flex items-center justify-between gap-2 pb-2.5">
              {/* Two options, so a segmented control rather than a select —
                  one tap instead of tap, scroll, tap. */}
              <div
                className="inline-flex rounded-full border border-hairline bg-white p-0.5"
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
                      "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-2xs font-semibold",
                      "transition-colors duration-[var(--duration-instant)] ease-out-strong",
                      line.kind === kind
                        ? "bg-navy-800 text-white"
                        : "text-copy-muted hover:text-navy-900",
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

              <div className="flex items-center gap-1.5">
                <span className="tabular font-mono text-note font-bold text-navy-900">
                  {formatAmount(num(line.quantity) * num(line.unitPrice))}
                </span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(line.key)}
                    title="Remove line"
                    className="grid size-9 place-items-center rounded-full text-copy-muted transition-colors hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    <span className="sr-only">Remove line {index + 1}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <input
                value={line.description}
                onChange={(event) => update(line.key, { description: event.target.value })}
                maxLength={200}
                placeholder={
                  line.kind === "labour"
                    ? "Trace fault and replace two socket outlets"
                    : "Double socket outlet"
                }
                aria-label={`Line ${index + 1} description`}
                className={lineControl}
              />

              <div className="grid grid-cols-[4.5rem_1fr] gap-2">
                <input
                  value={line.quantity}
                  onChange={(event) => update(line.key, { quantity: event.target.value })}
                  inputMode="decimal"
                  placeholder="1"
                  aria-label={`Line ${index + 1} quantity`}
                  className={cn(lineControl, "tabular text-center font-mono")}
                />

                {/* The currency sits inside the field rather than beside it, so
                    the digits start where the eye already is. */}
                <div
                  className={cn(
                    "flex items-center rounded-[0.75rem] border border-hairline bg-white",
                    "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-out-strong",
                    "hover:border-azure-300",
                    "focus-within:border-azure-500 focus-within:ring-4 focus-within:ring-azure-500/15",
                  )}
                >
                  <span className="pl-3 font-mono text-2xs font-semibold text-copy-muted select-none">
                    GHS
                  </span>
                  <input
                    value={line.unitPrice}
                    onChange={(event) => update(line.key, { unitPrice: event.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label={`Line ${index + 1} unit price`}
                    className="tabular min-h-11 w-full min-w-0 rounded-r-[0.75rem] bg-transparent px-2.5 font-mono text-ui text-navy-900 placeholder:text-copy-muted/60 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="navyOutline"
          size="sm"
          shape="pill"
          onClick={() => setLines((c) => [...c, blank("labour")])}
        >
          <Plus />
          Labour
        </Button>
        <Button
          type="button"
          variant="navyOutline"
          size="sm"
          shape="pill"
          onClick={() => setLines((c) => [...c, blank("material")])}
        >
          <Plus />
          Materials
        </Button>
      </div>

      <div className="space-y-2">
        <FieldLabel as="label" htmlFor="quoteNotes">
          Anything the client should know
          <span className="ml-1.5 tracking-normal normal-case opacity-70">optional</span>
        </FieldLabel>
        <textarea
          id="quoteNotes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Price includes testing the whole kitchen ring. I can come Thursday morning."
          className={cn(lineControl, "resize-none")}
        />
      </div>

      {/* The two numbers, live. This is the part of the screen PLAN.md §4
          actually asks for. */}
      <div className="space-y-2">
        <FieldLabel>What this means</FieldLabel>
        <QuoteSummary
          subtotal={subtotal}
          transportFee={context.transportFee}
          commissionPct={context.commissionPct}
        />
        {context.distanceKm !== null && (
          <p className="text-2xs leading-relaxed text-copy-muted">
            Transport is set by distance band —{" "}
            <span className="tabular font-mono">{context.distanceKm.toFixed(1)} km</span> puts this
            job at {formatAmount(context.transportFee)}, and it is paid to you in full.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="animate-fade-in text-note text-danger-600">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="navy"
        size="lg"
        shape="pill"
        block
        loading={pending}
        disabled={!ready}
        onClick={send}
      >
        <Send />
        Send this price to the client
      </Button>

      <p className="text-center text-2xs leading-relaxed text-copy-muted">
        They approve it before you travel. If they decline, the job goes back out and you keep your
        place in the queue for the next one.
      </p>
    </section>
  );
}
