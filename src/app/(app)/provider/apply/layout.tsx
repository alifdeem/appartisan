import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { ApplicationSteps } from "@/components/provider/application-steps";
import { stepCompletion } from "@/lib/providers/application";
import {
  getMyProvider,
  listProviderCategoryIds,
  listProviderDocuments,
} from "@/lib/providers/queries";

/**
 * The shell around the artisan application.
 *
 * Loads the three things the rail needs to draw its ticks — the provider row,
 * how many trades are selected, which documents exist — once, here, rather than
 * in each of the five steps. Every step page then loads only what it edits.
 *
 * The status gate lives here rather than in each page for the same reason a gate
 * belongs at the door: five copies of it is five chances for the sixth step
 * added later to be missed.
 */
export default async function ApplyLayout({ children }: LayoutProps<"/provider/apply">) {
  const provider = await getMyProvider();

  // Not an artisan account at all. The proxy already keeps clients out of
  // /provider, so this is the seeded-admin-poking-around case.
  if (!provider) redirect("/provider");

  // An application in review, or already decided, is not editable — the actions
  // refuse it too (see provider/actions.ts). Sending them to the dashboard where
  // the status actually lives beats rendering a form that cannot be saved.
  if (provider.verification_status !== "unsubmitted" && provider.verification_status !== "rejected") {
    redirect("/provider");
  }

  const [categoryIds, documents] = await Promise.all([
    listProviderCategoryIds(provider.profile_id),
    listProviderDocuments(provider.profile_id),
  ]);

  const completion = stepCompletion({
    provider,
    tradeCount: categoryIds.length,
    docTypes: documents.map((doc) => doc.doc_type),
  });

  const reapplying = provider.verification_status === "rejected";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/provider"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          My work
        </Link>

        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold text-ink-900">
            {reapplying ? "Update your application" : "Become a verified artisan"}
          </h1>
          <p className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-600">
            {reapplying
              ? "Fix what our team flagged, then send it back. Nothing you already filled in has been lost."
              : "Five short steps. Everything saves as you go, so you can stop and come back."}
          </p>
        </div>
      </div>

      {/* The rail is a sidebar on a wide screen and a progress bar on a phone.
          Order matters on mobile: the bar sits above the form, where it answers
          "how much is left" before the work rather than after it. */}
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start lg:-ml-3">
          <ApplicationSteps completion={completion} />

          <p className="mt-5 hidden items-start gap-2 rounded-card bg-ink-0 px-3.5 py-3 text-xs leading-relaxed text-ink-600 shadow-xs lg:flex">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-brand-600" aria-hidden />
            <span>
              Your Ghana Card is stored privately and seen only by our verification team. Clients
              never see it — they only see that you passed.
            </span>
          </p>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
