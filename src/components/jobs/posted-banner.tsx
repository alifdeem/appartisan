import { SuccessMark } from "@/components/mobile/success-mark";

/**
 * "Your job is posted" — the right-hand screen of the reference's
 * `@6-review and confirm`.
 *
 * **Why a panel and not a screen.** The reference gives success a whole page
 * with a "Go Your Task" button under it, which is one more tap to reach the
 * thing that was just created. `postJobAction` has always redirected to the job
 * itself with `?posted=1` — a parameter that until now nothing read — so the
 * confirmation lands *on* the job. The client gets the reassurance and the live
 * screen in one move, and the panel disappears on the next navigation or
 * refresh because the parameter does, with no dismissed-state to remember.
 *
 * **The three steps are the reference's, rewritten to be true.** It promises
 * "Taskers will make offers → Accept an offer → Chat with pros". Here the offer
 * goes to one artisan at a time rather than to a board (PLAN.md §14 — no
 * bidding), and there is no in-app chat. What replaces the third step is the
 * thing that actually matters to someone who has just posted: nobody travels,
 * and nothing is charged, until they approve a price.
 */
export function PostedBanner() {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-hairline bg-linear-to-b from-azure-50 to-white p-6 text-center">
      <SuccessMark className="mx-auto size-20 text-navy-800" />

      <h2 className="mt-2 font-space text-title-sm font-bold text-balance text-navy-900">
        Your job is posted
      </h2>
      <p className="mx-auto mt-2 max-w-xs text-note leading-relaxed text-copy-muted">
        We&rsquo;re looking for a verified artisan near you right now.
      </p>

      <ol className="mx-auto mt-5 max-w-xs space-y-2.5 text-left">
        {[
          "The nearest available artisan gets the job first.",
          "They send you an itemised price — labour and materials.",
          "Nobody travels and nothing is charged until you accept it.",
        ].map((step, index) => (
          <li key={step} className="flex gap-2.5 text-note leading-relaxed text-navy-900/85">
            <span className="tabular grid size-5 shrink-0 place-items-center rounded-full bg-navy-800 font-mono text-[0.625rem] font-bold text-white">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
