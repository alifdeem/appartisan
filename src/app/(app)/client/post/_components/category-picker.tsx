"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, Search } from "lucide-react";

import { startDraftAction } from "@/app/(app)/client/actions";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/lib/supabase/types";

/**
 * Choosing a service.
 *
 * Twenty-six categories is a lot to scan on a phone, and the client wants the
 * list to grow (PLAN.md §9) — so this is a filterable grid rather than a
 * select. Two details carry most of the usability:
 *
 *  • **The description is searched, not just the name.** Somebody with a
 *    blocked drain does not scan for "Plumbing"; they type "drain". Every
 *    category ships a description precisely so this works.
 *  • **The tapped tile shows the spinner.** One `pending` flag across a grid of
 *    26 would either spin everything or spin nothing; remembering which id was
 *    submitted is what makes the feedback land where the finger is.
 */
export function CategoryPicker({ categories }: { categories: CategoryRow[] }) {
  const [state, formAction, pending] = useActionState(startDraftAction, null);
  const [query, setQuery] = React.useState("");
  const [chosen, setChosen] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;

    return categories.filter((category) => {
      const haystack = `${category.name} ${category.description ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [categories, query]);

  return (
    <form action={formAction} className="space-y-5">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="What do you need? Try “leak”, “socket”, “AC”…"
        aria-label="Search services"
        autoComplete="off"
        leading={<Search className="size-4" aria-hidden />}
      />

      {state?.error && (
        <p role="alert" className="animate-fade-in text-sm text-danger-600">
          {state.error}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-ink-300 bg-ink-50 px-5 py-10 text-center">
          <p className="text-sm font-medium text-ink-800">No service matches “{query}”</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-500">
            Try a simpler word, or pick the closest trade — you can describe the exact problem on
            the next screen.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {filtered.map((category) => {
            const busy = pending && chosen === category.id;

            return (
              <li key={category.id}>
                <button
                  type="submit"
                  name="categoryId"
                  value={category.id}
                  onClick={() => setChosen(category.id)}
                  disabled={pending}
                  className={cn(
                    "flex h-full w-full flex-col items-start gap-2 rounded-card border border-ink-200 bg-ink-0 p-3.5 text-left shadow-xs",
                    "transition-[border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-out-strong",
                    "hover:-translate-y-px hover:border-brand-300 hover:shadow-md",
                    "focus-visible:border-brand-600 active:translate-y-0 active:scale-[0.99]",
                    "disabled:opacity-60",
                    busy && "border-brand-600 opacity-100",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-field transition-colors",
                      busy ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700",
                    )}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <CategoryIcon name={category.icon} />
                    )}
                  </span>

                  <span className="text-sm font-semibold leading-tight text-ink-900">
                    {category.name}
                  </span>

                  {category.description && (
                    <span className="line-clamp-2 text-xs leading-snug text-ink-500">
                      {category.description}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </form>
  );
}
