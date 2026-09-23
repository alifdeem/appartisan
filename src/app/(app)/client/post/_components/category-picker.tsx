"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, Search, X } from "lucide-react";

import { CategoryIcon } from "@/components/marketplace/category-icon";
import { StartDraftForm, TradeTile, useStartDraft } from "@/components/mobile/start-draft";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/lib/supabase/types";

/**
 * Browse — every trade, as photographs.
 *
 * **Why this stopped being an icon grid.** Twenty-six identical tinted circles
 * is a *list of words with decoration*: at a glance nothing distinguishes
 * Roofing from Upholstery, so the eye has to read all twenty-six labels in
 * order, and the screen reads as a settings menu rather than as a place you buy
 * something. The photograph is the fastest possible answer to "is this the one
 * I want" — a picture of someone up a ladder with roofing sheets is understood
 * before the word "Roofing" has been read, and it works for a client whose
 * English is their second or third language.
 *
 * The cards are portrait, not square. Two portrait cards per row show a person
 * doing the work at a readable size; two squares show a crop of a wall.
 *
 * **The name sits on the photograph, not under it.** The scrim is a gradient,
 * not a flat wash, so the top of the image stays clean and the bottom carries
 * enough darkness for white text at any luminance the photograph happens to
 * have. That is what lets 26 photographs of wildly different brightness all
 * take the same treatment without any of them being unreadable.
 *
 * **A trade with no photograph is not a broken card.** It renders its icon on
 * the brand tint at the same aspect ratio, so the grid stays even and nothing
 * moves when the photograph lands.
 */
export function CategoryPicker({
  categories,
  photos,
}: {
  categories: CategoryRow[];
  /** Slug → public path, or null when the photograph is not on disk yet. */
  photos: Record<string, string | null>;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;

    // The description is searched too, not just the name. Somebody with a
    // blocked drain does not scan for "Plumbing"; they type "drain". Every
    // category ships a description precisely so this works.
    return categories.filter((category) =>
      `${category.name} ${category.description ?? ""}`.toLowerCase().includes(needle),
    );
  }, [categories, query]);

  return (
    <div className="space-y-5">
      {/* Outside the form. A text field inside a form whose every button is a
          submit means Enter fires whichever trade happens to be first in the
          grid — the search box would post Electrical. */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-copy-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “leak”, “socket”, “AC”…"
          aria-label="Search services"
          autoComplete="off"
          // `text-base`: iOS zooms the page on focus for anything smaller.
          className={cn(
            "min-h-14 w-full rounded-[1.75rem] border border-hairline bg-white pr-12 pl-13 text-base text-navy-900",
            "shadow-[var(--shadow-float)] placeholder:text-copy-muted/70",
            "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-out-strong",
            "focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15 focus:outline-none",
            "[&::-webkit-search-cancel-button]:hidden",
          )}
        />

        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-copy-muted transition-colors hover:text-navy-900"
          >
            <X className="size-4.5" aria-hidden />
          </button>
        )}
      </div>

      {/* A live count, so a search that narrows 26 to 2 says so rather than
          leaving the reader to notice the grid got shorter. */}
      <p aria-live="polite" className="text-note text-copy-muted">
        {query
          ? `${filtered.length} ${filtered.length === 1 ? "trade" : "trades"} match “${query}”`
          : `${categories.length} trades, all verified`}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-hairline bg-azure-50/50 px-5 py-10 text-center">
          <p className="text-note font-semibold text-navy-900">Nothing matches that</p>
          <p className="mx-auto mt-1.5 max-w-xs text-note leading-relaxed text-copy-muted">
            Try a simpler word, or pick the closest trade — you can describe the exact problem on
            the next screen.
          </p>
        </div>
      ) : (
        <StartDraftForm>
          <ul className="grid grid-cols-2 gap-3">
            {filtered.map((category) => (
              <li key={category.id}>
                <TradeCard category={category} src={photos[category.slug] ?? null} />
              </li>
            ))}
          </ul>
        </StartDraftForm>
      )}
    </div>
  );
}

function TradeCard({ category, src }: { category: CategoryRow; src: string | null }) {
  const { pending, chosenId } = useStartDraft();
  const busy = pending && chosenId === category.id;

  return (
    <TradeTile
      categoryId={category.id}
      className={cn(
        "group relative block w-full overflow-hidden rounded-[1.5rem] border border-hairline bg-azure-50",
        "shadow-[var(--shadow-float)]",
        "transition-[box-shadow,transform,border-color] duration-[var(--duration-fast)] ease-out-strong",
        "hover:-translate-y-0.5 hover:border-azure-300 hover:shadow-[var(--shadow-sheet)]",
        "active:translate-y-0 active:scale-[0.98]",
        busy && "border-azure-500",
      )}
    >
      <div className="relative aspect-[3/4] w-full">
        {src ? (
          <>
            <Image
              src={src}
              alt=""
              fill
              // Two columns inside a 26rem column: ~200px each, 400 at 2×.
              sizes="(max-width: 26rem) 45vw, 200px"
              className="object-cover transition-transform duration-[var(--duration-slow)] ease-out-strong group-hover:scale-[1.05]"
            />
            {/* A ramp, not a flat wash: the top of the photograph stays clean
                and the bottom carries enough darkness for white text whatever
                the image's own luminance is. */}
            <span
              aria-hidden
              className="absolute inset-0 bg-linear-to-t from-navy-950/85 via-navy-950/25 to-transparent"
            />
          </>
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 grid place-items-center bg-linear-to-br from-azure-50 to-azure-100 text-navy-800/30"
          >
            <CategoryIcon name={category.icon ?? "wrench"} className="size-12" />
          </span>
        )}

        {/* The icon chip. On a photograph it is the one piece of brand on the
            card; on the fallback it would repeat the giant icon behind it, so
            it only renders when there is a photograph. */}
        {src && (
          <span
            aria-hidden
            className="absolute top-3 left-3 grid size-9 place-items-center rounded-full bg-white/90 text-navy-800 backdrop-blur-sm"
          >
            <CategoryIcon name={category.icon ?? "wrench"} className="size-4.5" />
          </span>
        )}

        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-navy-950/45 text-white">
            <Loader2 className="size-7 animate-spin" aria-hidden />
          </span>
        )}

        <span className="absolute inset-x-0 bottom-0 p-3.5">
          <span
            className={cn(
              "block font-space text-note leading-tight font-bold text-balance",
              src ? "text-white" : "text-navy-900",
            )}
          >
            {category.name}
          </span>
          {category.description && (
            <span
              className={cn(
                "mt-1 block line-clamp-2 text-2xs leading-snug",
                src ? "text-white/75" : "text-copy-muted",
              )}
            >
              {category.description}
            </span>
          )}
        </span>
      </div>
    </TradeTile>
  );
}
