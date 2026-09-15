import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TradePicker } from "@/app/(app)/provider/apply/trades/_components/trade-picker";
import { listActiveCategories } from "@/lib/jobs/queries";
import { getMyProvider, listProviderCategoryIds } from "@/lib/providers/queries";

export const metadata: Metadata = { title: "Your trades" };

export default async function TradesStepPage() {
  const provider = await getMyProvider();
  if (!provider) redirect("/provider");

  const [categories, selected] = await Promise.all([
    listActiveCategories(),
    listProviderCategoryIds(provider.profile_id),
  ]);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ink-900">What do you do?</h2>
        <p className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-600">
          Pick the work you want to be called for. You will only be offered jobs in these trades,
          so choose the ones you are confident quoting on — not everything you have ever done.
        </p>
      </div>

      <TradePicker categories={categories} selected={selected} />
    </div>
  );
}
