"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check, Search } from "lucide-react";

import { saveTradesAction } from "@/app/(app)/provider/actions";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/lib/supabase/types";

const MAX_TRADES = 6;

/**
 * Which trades an artisan works in.
 *
 * The client's version of this grid (`category-picker`) picks exactly one and
 * submits on tap. This one is multi-select with a deliberate ceiling, and the
 * two differences are both about who is choosing.
 *
 * A client picking a category is describing a problem they have right now. An
 * artisan is describing themselves, and the incentive runs the other way:
 * ticking everything maximises the offers you see, which is exactly why it must
 * not be free. Six is the cap and the count is always visible, because an
 * artisan who claims eleven trades has credibly claimed none of them — and the
 * matcher would offer them all eleven.
 *
 * Selection is local state submitted in one go, rather than a write per tap.
 * The set is replaced wholesale on the server anyway, and eleven round trips
 * while somebody makes up their mind is eleven chances to half-save it.
 */
export function TradePicker({
  categories,
  selected: initialSelected,
}: {
  categories: CategoryRow[];
  selected: string[];
}) {
  const [state, formAction, pending] = useActionState(saveTradesAction, null);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(initialSelected));
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;
    return categories.filter((category) =>
      `${category.name} ${category.description ?? ""}`.toLowerCase().includes(needle),
    );
  }, [categories, query]);

  const atLimit = selected.size >= MAX_TRADES;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_TRADES) next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="categoryId" value={id} />
      ))}

      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search trades: plumbing, AC, welding…"
        aria-label="Search trades"
        autoComplete="off"
        leading={<Search className="size-4" aria-hidden />}
      />

      {filtered.length === 0 ? (
        <p className="rounded-card border border-dashed border-hairline bg-canvas px-5 py-10 text-center text-sm text-copy-muted">
          Nothing matches “{query.trim()}”. Our team adds new trades regularly.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {filtered.map((category) => {
            const isSelected = selected.has(category.id);
            // Dimmed rather than removed: a grid that reshuffles as you pick is
            // a grid where your next tap lands on the wrong thing.
            const blocked = atLimit && !isSelected;

            return (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => toggle(category.id)}
                  aria-pressed={isSelected}
                  disabled={blocked}
                  className={cn(
                    "relative flex size-full flex-col items-start gap-2 rounded-card border p-3.5 text-left",
                    "transition-[border-color,background-color,transform,box-shadow]",
                    "duration-[var(--duration-fast)] ease-out-strong active:scale-[0.98]",
                    isSelected
                      ? "border-navy-800 bg-azure-50 shadow-xs ring-1 ring-navy-800"
                      : "border-hairline bg-white shadow-xs hover:border-hairline",
                    blocked && "cursor-not-allowed opacity-45 active:scale-100",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-field transition-colors duration-[var(--duration-fast)]",
                      isSelected ? "bg-navy-800 text-white" : "bg-azure-50 text-copy-muted",
                    )}
                  >
                    {isSelected ? (
                      <Check className="size-4 animate-fade-in" strokeWidth={3} aria-hidden />
                    ) : (
                      <CategoryIcon name={category.icon} className="size-[1.125rem]" />
                    )}
                  </span>

                  <span
                    className={cn(
                      "text-sm leading-snug font-medium",
                      isSelected ? "text-navy-900" : "text-navy-900",
                    )}
                  >
                    {category.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {state?.error && (
        <p role="alert" className="animate-fade-in text-sm text-danger-600">
          {state.error}
        </p>
      )}

      {/* Sticky on a phone: the grid is long, and a Continue button at the
          bottom of 26 tiles is a button nobody finds without scrolling twice. */}
      <div className="sticky bottom-0 -mx-5 flex items-center gap-4 border-t border-hairline bg-canvas/95 px-5 py-3 backdrop-blur-md sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        <p className="tabular flex-1 font-mono text-sm text-copy-muted">
          {selected.size}
          <span className="text-copy-muted">/{MAX_TRADES}</span>
          <span className="ml-2 font-sans text-copy-muted">
            {selected.size === 0 ? "Pick at least one" : atLimit ? "That's the limit" : "selected"}
          </span>
        </p>

        <Button type="submit" size="lg" loading={pending} disabled={selected.size === 0}>
          Continue
        </Button>
      </div>
    </form>
  );
}
