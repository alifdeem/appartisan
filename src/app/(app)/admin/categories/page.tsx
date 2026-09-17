import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CategoryRow } from "./_components/category-row";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { CategoryRow as Category } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Trades" };

/**
 * Service categories (PLAN.md §9).
 *
 * The launch set is 26 trades and the client wants to add more without a
 * deploy, so this is the screen that keeps that promise. Retired trades stay
 * on the list, greyed — they are still attached to every job booked under
 * them, and hiding them here would make an admin think a trade had gone.
 *
 * Read with the admin's own session: the `categories: public read` policy only
 * exposes active rows to everyone else, and the `or public.is_admin()` clause
 * on it is what makes the retired ones visible here.
 */
export default async function CategoriesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order")
    .order("name");

  if (error) console.error("[admin] listing categories failed:", error.message);

  const categories = (data ?? []) as Category[];
  const active = categories.filter((c) => c.is_active).length;

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Admin
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink-900">Trades</h1>
        <p className="text-[0.9375rem] text-ink-600">
          {active} offered to clients
          {categories.length > active ? `, ${categories.length - active} retired` : ""}.
        </p>
      </div>

      <Card>
        <CardContent className="py-0">
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-800">Add a trade</h2>
        <Card>
          <CardContent className="py-0">
            <CategoryRow category={null} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
