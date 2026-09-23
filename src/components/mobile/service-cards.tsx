"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";

import { CategoryIcon } from "@/components/marketplace/category-icon";
import { TradeTile, useStartDraft } from "@/components/mobile/start-draft";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/lib/supabase/types";

/**
 * The featured trades, as the reference's horizontal photo cards.
 *
 * Tapping one starts a draft for that trade and lands on the description form —
 * see `start-draft.tsx`.
 *
 * **What is on a card, and what the reference puts there that is not.** The
 * mockup's cards carry a name, a rating, a job count and a "from GH₵120". Three
 * of those four cannot be true here:
 *
 *  • *A price.* PLAN.md §9 — artisans price each job themselves after seeing
 *    it, and there is no price guidance in v1. Any figure on this card is
 *    invented, and an invented price on the home screen is the first thing a
 *    client would hold us to.
 *  • *A rating and a job count on a trade.* Ratings attach to artisans, not to
 *    trades, and artisans are matched to a job rather than browsed (§14). "4.9 ★
 *    Plumbing" is a number about nothing.
 *  • *A named professional.* Same reason — there is no public artisan
 *    directory to feature from.
 *
 * What *is* true and worth a card is the trade itself and what it covers, which
 * is already in `categories.description` and written by the client's own admin.
 * So the card is a photograph, a name, and the one line that tells you whether
 * your problem belongs here.
 *
 * The photograph is optional. Without a file the card falls back to a tinted
 * panel carrying the trade's icon at size — a deliberate-looking card rather
 * than a broken one — and the layout does not move when the photograph lands,
 * because the slot already holds its final aspect ratio.
 */
export function ServiceCards({
  categories,
  photos,
}: {
  categories: CategoryRow[];
  /** Slug → public path, or null when the photograph is not on disk yet. */
  photos: Readonly<Record<string, string | null>>;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex snap-x gap-3.5">
        {categories.map((category) => (
          <li key={category.id} className="snap-start">
            <ServiceCard category={category} src={photos[category.slug] ?? null} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ServiceCard({ category, src }: { category: CategoryRow; src: string | null }) {
  const { pending, chosenId } = useStartDraft();
  const busy = pending && chosenId === category.id;

  return (
    <TradeTile
      categoryId={category.id}
      className={cn(
        "group block w-[10.5rem] overflow-hidden rounded-[1.25rem] border border-hairline bg-white",
        "shadow-[var(--shadow-float)]",
        "transition-[box-shadow,transform,border-color] duration-[var(--duration-fast)] ease-out-strong",
        "hover:-translate-y-0.5 hover:border-azure-300 hover:shadow-[var(--shadow-sheet)]",
        "active:translate-y-0 active:scale-[0.98]",
        busy && "border-azure-500",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-azure-50">
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            sizes="168px"
            className="object-cover transition-transform duration-[var(--duration-slow)] ease-out-strong group-hover:scale-[1.04]"
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 grid place-items-center bg-linear-to-br from-azure-50 to-azure-100 text-navy-800/35"
          >
            <CategoryIcon name={category.icon ?? "wrench"} className="size-11" />
          </span>
        )}

        {/* The scrim only exists where a photograph does — over the flat
            fallback it would darken a panel that has nothing to protect. */}
        {src && (
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-navy-950/45 to-transparent"
          />
        )}

        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-white/70 text-navy-800">
            <Loader2 className="size-6 animate-spin" aria-hidden />
          </span>
        )}
      </div>

      <div className="p-3.5">
        <p className="truncate font-space text-note font-bold text-navy-900">{category.name}</p>
        {category.description && (
          <p className="mt-1 line-clamp-2 text-2xs leading-snug text-copy-muted">
            {category.description}
          </p>
        )}
      </div>
    </TradeTile>
  );
}

/**
 * Everything else — the full trade list as a three-column grid.
 *
 * This is the reference's "Explore our Services" section. The grid is icons
 * rather than photographs for the same reason the chips are: 26 photographs is
 * not a design decision, it is a procurement problem, and a grid where six
 * tiles have pictures and twenty do not looks broken rather than partial.
 */
export function ServiceGrid({ categories }: { categories: CategoryRow[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2.5">
      {categories.map((category) => (
        <li key={category.id}>
          <GridTile category={category} />
        </li>
      ))}
    </ul>
  );
}

function GridTile({ category }: { category: CategoryRow }) {
  const { pending, chosenId } = useStartDraft();
  const busy = pending && chosenId === category.id;

  return (
    <TradeTile
      categoryId={category.id}
      className={cn(
        "flex h-full w-full flex-col items-center gap-2 rounded-[1.25rem] border border-hairline bg-white p-3 text-center",
        "transition-[border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-out-strong",
        "hover:-translate-y-0.5 hover:border-azure-300 hover:shadow-[var(--shadow-float)]",
        "active:translate-y-0 active:scale-[0.97]",
        busy && "border-azure-500",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
          busy ? "bg-navy-800 text-white" : "bg-azure-50 text-navy-800",
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <CategoryIcon name={category.icon ?? "wrench"} className="size-5" />
        )}
      </span>
      {/* `text-balance` matters at three columns: "AC & Refrigeration"
          breaks to a lonely "Refrigeration" without it. */}
      <span className="text-2xs leading-tight font-semibold text-balance text-navy-900">
        {category.name}
      </span>
    </TradeTile>
  );
}
