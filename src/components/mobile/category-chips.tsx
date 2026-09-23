"use client";

import { Loader2 } from "lucide-react";

import { CategoryIcon } from "@/components/marketplace/category-icon";
import { TradeTile, useStartDraft } from "@/components/mobile/start-draft";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/lib/supabase/types";

/**
 * Browse by category — the reference's premium chip row.
 *
 * A pill per trade: a circular icon tile on the left, the name beside it,
 * horizontally scrolled with `snap-x` so a flick lands on a chip rather than
 * between two.
 *
 * **Tapping one starts the job.** The chip submits `startDraftAction` and the
 * next screen is the description form with that trade already chosen — see
 * `start-draft.tsx` for why these are buttons rather than links. Before this
 * they were links into the picker, which meant choosing a trade on the home
 * screen and then being asked to choose a trade.
 *
 * **Why none of them is "active".** The reference paints one chip navy and the
 * rest white, which reads as a selected filter. Nothing is selected here — the
 * chips are twenty-six ways out of this screen, not a control with a value. So
 * the navy fill is the **press** state instead: the reference's visual language
 * kept exactly, moved to the moment where it means something.
 *
 * **Icons, not photographs.** There are 26 trades. Photographs are reserved for
 * the six featured cards below, where there is room for them to be worth their
 * bytes; at chip size a photograph is a 40px thumbnail nobody can read.
 */
export function CategoryChips({ categories }: { categories: CategoryRow[] }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex snap-x gap-2.5">
        {categories.map((category) => (
          <li key={category.id} className="snap-start">
            <Chip category={category} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ category }: { category: CategoryRow }) {
  const { pending, chosenId } = useStartDraft();
  const busy = pending && chosenId === category.id;

  return (
    <TradeTile
      categoryId={category.id}
      className={cn(
        "group flex min-h-13 items-center gap-2.5 rounded-full border border-hairline bg-white py-2 pr-5 pl-2 whitespace-nowrap shadow-[var(--shadow-float)]",
        "transition-[background-color,border-color,color,transform] duration-[var(--duration-fast)] ease-out-strong",
        "hover:border-navy-800 hover:bg-navy-800 active:scale-[0.97]",
        busy && "border-navy-800 bg-navy-800",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-[var(--duration-fast)]",
          busy ? "bg-white/15 text-white" : "bg-azure-50 text-navy-800",
          "group-hover:bg-white/15 group-hover:text-white",
        )}
      >
        {busy ? (
          <Loader2 className="size-[1.125rem] animate-spin" aria-hidden />
        ) : (
          <CategoryIcon name={category.icon ?? "wrench"} className="size-[1.125rem]" />
        )}
      </span>

      <span
        className={cn(
          "text-note font-semibold transition-colors duration-[var(--duration-fast)] group-hover:text-white",
          busy ? "text-white" : "text-navy-900",
        )}
      >
        {category.name}
      </span>
    </TradeTile>
  );
}
