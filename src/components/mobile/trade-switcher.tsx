"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, Search, X } from "lucide-react";

import { CategoryIcon } from "@/components/marketplace/category-icon";
import { switchDraftCategoryAction } from "@/app/(app)/client/actions";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/lib/supabase/types";

/**
 * The chip row at the top of `@1-main`, and the `@2-browse` sheet behind it.
 *
 * The reference puts a horizontally-scrolled row of trades above the
 * description, with the chosen one filled, so changing your mind costs one tap
 * rather than a trip back to a picker. That is what this is.
 *
 * **The chosen trade is pinned first.** A plain `sort_order` row would put
 * Electrical at the left whatever you picked, so the one chip whose state
 * actually matters could be six scroll-positions off-screen. The selected chip
 * leads, the rest follow in their usual order.
 *
 * **Only the first few are chips.** Twenty-six in a scroller is a long flick to
 * reach the tail; the chips carry the likely re-picks and "All trades" opens the
 * sheet, which is searchable. That is the reference's own division of labour
 * between `@1-main` and `@2-browse`.
 *
 * Switching writes to the draft immediately rather than staging a change, for
 * the same reason the photo uploader does: the description and the photographs
 * already belong to this job, and a trade change that only lands on Continue
 * would be lost by anyone who switched and then closed the app.
 */
export function TradeSwitcher({
  jobId,
  categories,
  selectedId,
}: {
  jobId: string;
  categories: CategoryRow[];
  selectedId: string;
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState(switchDraftCategoryAction, null);
  const [chosenId, setChosenId] = React.useState<string | null>(null);

  // Selected first, everything else in the catalogue's own order.
  const ordered = React.useMemo(() => {
    const selected = categories.filter((c) => c.id === selectedId);
    return [...selected, ...categories.filter((c) => c.id !== selectedId)];
  }, [categories, selectedId]);

  const chips = ordered.slice(0, 8);

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />

      {state?.error && (
        <p role="alert" className="mb-2 text-note text-danger-600">
          {state.error}
        </p>
      )}

      <div className="-mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-2">
          {chips.map((category) => (
            <Chip
              key={category.id}
              category={category}
              selected={category.id === selectedId}
              busy={pending && chosenId === category.id}
              disabled={pending}
              onPick={() => setChosenId(category.id)}
            />
          ))}

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            disabled={pending}
            className="min-h-11 shrink-0 rounded-full border border-dashed border-hairline px-4 text-note font-semibold whitespace-nowrap text-azure-600 transition-colors duration-[var(--duration-fast)] hover:border-azure-500 hover:bg-azure-50 disabled:opacity-55"
          >
            All trades
          </button>
        </div>
      </div>

      {sheetOpen && (
        <TradeSheet
          categories={categories}
          selectedId={selectedId}
          pending={pending}
          chosenId={chosenId}
          onPick={setChosenId}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </form>
  );
}

function Chip({
  category,
  selected,
  busy,
  disabled,
  onPick,
}: {
  category: CategoryRow;
  selected: boolean;
  busy: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="submit"
      name="categoryId"
      value={category.id}
      onClick={onPick}
      // The selected chip is not a control — pressing it would write the trade
      // it already has. Disabling it also stops it taking a tab stop in a row
      // whose whole purpose is "everything except this one".
      disabled={disabled || selected}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 whitespace-nowrap",
        "transition-[background-color,border-color,color] duration-[var(--duration-fast)] ease-out-strong",
        selected
          ? "bg-linear-to-b from-navy-800 to-navy-900 text-white shadow-[var(--shadow-glow-navy)] disabled:opacity-100"
          : "border border-hairline bg-white text-navy-900 hover:border-navy-800 hover:bg-navy-800 hover:text-white disabled:opacity-55",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full transition-colors",
          selected ? "bg-white/15" : "bg-azure-50",
        )}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <CategoryIcon name={category.icon ?? "wrench"} className="size-4" />
        )}
      </span>
      <span className="text-note font-semibold">{category.name}</span>
    </button>
  );
}

/**
 * `@2-browse` — the full list, searchable, over the form.
 *
 * A bottom sheet rather than a route, because the reference shows the form
 * still there behind it: changing your trade is an adjustment to the thing you
 * are already filling in, not a departure from it. Navigating away and back
 * would also cost the unsaved contents of the description box.
 *
 * The reference's sheet also carries distance, experience and price filters.
 * Those are gone for the same reason they are gone from the home screen —
 * artisans are matched by the matcher, not browsed and filtered by hand.
 */
function TradeSheet({
  categories,
  selectedId,
  pending,
  chosenId,
  onPick,
  onClose,
}: {
  categories: CategoryRow[];
  selectedId: string;
  pending: boolean;
  chosenId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;
    return categories.filter((c) =>
      `${c.name} ${c.description ?? ""}`.toLowerCase().includes(needle),
    );
  }, [categories, query]);

  // Escape closes it, which is the one keyboard affordance a sheet must have.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-navy-950/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Browse by category"
        className="animate-sheet-in relative mx-auto flex max-h-[85dvh] w-full max-w-[26rem] flex-col rounded-t-[2rem] bg-white pb-6 shadow-[var(--shadow-sheet)]"
      >
        <div className="shrink-0 space-y-4 px-5 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-space text-lede font-bold text-navy-900">Browse by category</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 grid size-11 place-items-center rounded-full text-copy-muted transition-colors hover:bg-azure-50 hover:text-navy-900"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-copy-muted"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “leak”, “socket”, “AC”…"
              aria-label="Search trades"
              autoComplete="off"
              className="min-h-13 w-full rounded-[1.5rem] border border-hairline bg-white pr-4 pl-11 text-base text-navy-900 placeholder:text-copy-muted/70 focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-note text-copy-muted">
              No trade matches &ldquo;{query}&rdquo;. Try a simpler word.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((category) => {
                const selected = category.id === selectedId;
                const busy = pending && chosenId === category.id;

                return (
                  <li key={category.id}>
                    <button
                      type="submit"
                      name="categoryId"
                      value={category.id}
                      onClick={() => onPick(category.id)}
                      disabled={pending || selected}
                      aria-current={selected ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[1.25rem] p-3 text-left",
                        "transition-colors duration-[var(--duration-fast)]",
                        selected
                          ? "bg-azure-50 disabled:opacity-100"
                          : "hover:bg-azure-50/60 disabled:opacity-55",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-full",
                          selected ? "bg-navy-800 text-white" : "bg-azure-50 text-navy-800",
                        )}
                      >
                        {busy ? (
                          <Loader2 className="size-5 animate-spin" aria-hidden />
                        ) : (
                          <CategoryIcon name={category.icon ?? "wrench"} className="size-5" />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ui font-semibold text-navy-900">
                          {category.name}
                        </span>
                        {category.description && (
                          <span className="block truncate text-note text-copy-muted">
                            {category.description}
                          </span>
                        )}
                      </span>

                      {selected && (
                        <span className="shrink-0 text-2xs font-bold tracking-wide text-azure-600 uppercase">
                          Chosen
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
