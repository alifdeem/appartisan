import { AlertTriangle } from "lucide-react";

/**
 * The honesty banner.
 *
 * PLAN.md §1 puts legal fees outside the $10k, and §4 says a Ghanaian fintech
 * lawyer must read the terms before launch — "outside the $10k, but not
 * optional". So these documents are a complete, specific draft of what the
 * platform actually does, written so a lawyer has something concrete to mark
 * up rather than a blank page and an hourly rate.
 *
 * The banner stays until someone qualified has signed them off, and it is not
 * decorative: shipping an unreviewed contract while implying it was reviewed
 * is worse than shipping no contract at all.
 */
export function DraftNotice() {
  return (
    <aside className="not-prose my-6 flex items-start gap-3 rounded-card border border-dashed border-warning-500 bg-warning-50 px-4 py-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden />
      <div className="space-y-1 text-sm text-warning-700">
        <p className="font-semibold">Draft — not yet reviewed by a lawyer.</p>
        <p>
          This describes exactly how the platform works today and is written to be handed to a
          Ghanaian legal adviser for review before launch. It is not yet a binding agreement.
        </p>
      </div>
    </aside>
  );
}
