import Link from "next/link";

import { CategoryIcon } from "@/components/marketplace/category-icon";
import type { CategoryRow } from "@/lib/supabase/types";

/**
 * Browse by category.
 *
 * **Icons, not photographs.** The reference fills each card with a stock photo
 * of somebody at work. There are 26 trades here and four photographs in
 * `public/img/` — so matching the reference would mean either sourcing 26
 * stock images the client has not paid for, or repeating four across twenty-six
 * tiles, which reads as a bug. The icons are already in the database
 * (`categories.icon`), already admin-editable, and weigh nothing on a metered
 * Ghanaian connection.
 *
 * Horizontally scrolled, as in the reference, because a 26-item grid on a phone
 * is a wall. `snap-x` so a flick lands on a tile rather than between two.
 *
 * No "Available · at your area" badge. The reference shows one on every card,
 * where it is decoration; here it would be a claim about supply we cannot make
 * until a job is actually posted and the matcher has run.
 */
export function CategoryChips({ categories }: { categories: CategoryRow[] }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex snap-x snap-mandatory gap-3">
        {categories.map((category) => (
          <li key={category.id} className="snap-start">
            <Link
              href={`/client/post?category=${category.slug}`}
              className="flex h-full w-[7.5rem] flex-col gap-2.5 rounded-card border border-ink-200 bg-white p-3.5 transition-colors hover:border-ink-300"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                <CategoryIcon name={category.icon ?? "wrench"} className="size-5" />
              </span>
              <span className="text-sm leading-snug font-medium text-balance text-ink-900">
                {category.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
