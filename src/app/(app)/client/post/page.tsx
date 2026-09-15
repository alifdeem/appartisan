import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CategoryPicker } from "@/app/(app)/client/post/_components/category-picker";
import { listActiveCategories } from "@/lib/jobs/queries";

export const metadata: Metadata = { title: "Book a service" };

export default async function ChooseServicePage() {
  const categories = await listActiveCategories();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/client"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          My jobs
        </Link>

        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold text-ink-900">What do you need doing?</h1>
          <p className="max-w-prose text-[0.9375rem] text-ink-600">
            Pick the closest trade. You&rsquo;ll describe the exact problem next — nothing is
            booked and nothing is charged until you approve a price.
          </p>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-card border border-dashed border-ink-300 bg-ink-50 px-5 py-10 text-center">
          <p className="text-sm font-medium text-ink-800">No services are listed yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
            The service catalogue has not been loaded into this database. Run the reference data
            migration and refresh.
          </p>
        </div>
      ) : (
        <CategoryPicker categories={categories} />
      )}
    </div>
  );
}
