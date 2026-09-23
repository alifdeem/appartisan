import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";

/**
 * The home screen's primary action, in a search bar's clothes.
 *
 * **It is a link, not an input.** There is nothing to search yet: the corpus is
 * 26 categories, all of which are on this same screen, and a box that filters a
 * list you can already see costs a tap and returns nothing. What a thumb
 * actually wants at the top of this screen is "start a job", and the search bar
 * is simply the shape people reach for. Tapping it opens the category picker,
 * which is where a typed query would have sent them anyway.
 *
 * It renders as `role="search"` with a real label so it is announced as what it
 * does rather than as a bare link, and it is a 56px pill because the brief asks
 * for one and because it is the largest tap target on the screen.
 *
 * The filter button beside it goes to the same place. The reference uses that
 * slot for price/distance/rating filters; ArtisanGH has no artisan browsing to
 * filter (PLAN.md §14) and the trades themselves are the only axis, so it opens
 * the full trade list rather than a sheet of controls with nothing behind them.
 */
export function SearchPill() {
  return (
    <search className="flex items-center gap-3">
      <Link
        href="/client/post"
        className="group flex min-h-14 flex-1 items-center gap-3 rounded-[1.75rem] border border-hairline bg-white px-5 shadow-[var(--shadow-float)] transition-[border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-out-strong hover:-translate-y-px hover:border-azure-300 hover:shadow-[var(--shadow-sheet)] active:translate-y-0"
      >
        <Search className="size-5 shrink-0 text-copy-muted" aria-hidden />
        <span className="truncate text-ui text-copy-muted">What do you need doing?</span>
      </Link>

      <Link
        href="/client/post"
        aria-label="Browse all trades"
        className="grid size-14 shrink-0 place-items-center rounded-full bg-linear-to-b from-navy-800 to-navy-900 text-white shadow-[var(--shadow-glow-navy)] transition-[box-shadow,transform] duration-[var(--duration-instant)] ease-out-strong hover:-translate-y-px hover:shadow-[var(--shadow-glow-navy-lg)] active:translate-y-0 active:scale-[0.97]"
      >
        <SlidersHorizontal className="size-5" aria-hidden />
      </Link>
    </search>
  );
}
