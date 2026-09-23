import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CategoryPicker } from "@/app/(app)/client/post/_components/category-picker";
import { categoryPhotoMap } from "@/lib/images";
import { listActiveCategories } from "@/lib/jobs/queries";

export const metadata: Metadata = { title: "Book a service" };

/**
 * The full trade list — the Browse tab, and the "Change" link out of a draft.
 *
 * This is no longer the only way into the posting flow: tapping any trade on
 * the home screen now starts the draft directly. It stays because it is the
 * searchable one, and because a client who does not recognise their problem in
 * six featured cards needs somewhere to type "drain".
 */
export default async function ChooseServicePage() {
  const categories = await listActiveCategories();
  const photos = categoryPhotoMap(categories.map((category) => category.slug));

  return (
    // pb-28 clears the fixed tab bar — this route is the Browse tab, so the bar
    // is showing here (it hides itself once a draft exists).
    <div className="space-y-6 pb-28">
      <header className="space-y-4">
        <Link
          href="/client"
          aria-label="Go back"
          className="-ml-2 grid size-11 place-items-center rounded-full text-navy-900 transition-colors duration-[var(--duration-instant)] hover:bg-azure-50"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>

        <div className="space-y-2">
          <h1 className="font-space text-title font-bold text-balance text-navy-900">
            What do you need doing?
          </h1>
          <p className="text-note leading-relaxed text-copy-muted">
            Pick the closest trade. You&rsquo;ll describe the exact problem next — nothing is
            booked and nothing is charged until you approve a price.
          </p>
        </div>
      </header>

      {categories.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-hairline bg-azure-50/50 px-5 py-10 text-center">
          <p className="text-note font-semibold text-navy-900">No services are listed yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-note leading-relaxed text-copy-muted">
            The service catalogue has not been loaded into this database. Run the reference data
            migration and refresh.
          </p>
        </div>
      ) : (
        <CategoryPicker categories={categories} photos={photos} />
      )}
    </div>
  );
}
