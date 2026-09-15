import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PayoutForm } from "@/app/(app)/provider/apply/payout/_components/payout-form";
import { getCurrentProfile } from "@/lib/supabase/server";
import { getMyProvider } from "@/lib/providers/queries";

export const metadata: Metadata = { title: "Getting paid" };

export default async function PayoutStepPage() {
  const [provider, profile] = await Promise.all([getMyProvider(), getCurrentProfile()]);
  if (!provider) redirect("/provider");

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ink-900">Where your money goes</h2>
        <p className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-600">
          Clients pay ArtisanGH, and we send your share to your mobile money after the job is
          signed off. Nothing is held in an account here — the money moves per job.
        </p>
      </div>

      <PayoutForm
        momoNumber={provider.momo_number}
        momoNetwork={provider.momo_network}
        accountPhone={profile?.phone ?? null}
      />
    </div>
  );
}
