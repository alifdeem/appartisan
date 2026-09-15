import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AboutForm } from "@/app/(app)/provider/apply/about/_components/about-form";
import { getCurrentProfile } from "@/lib/supabase/server";
import { getMyProvider } from "@/lib/providers/queries";

export const metadata: Metadata = { title: "About you" };

export default async function AboutStepPage() {
  const [provider, profile] = await Promise.all([getMyProvider(), getCurrentProfile()]);
  if (!provider) redirect("/provider");

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ink-900">About your work</h2>
        <p className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-600">
          A client sees this before they accept your quote. Write it the way you would explain
          your work to a neighbour, not the way you would write a CV.
        </p>
      </div>

      <AboutForm
        bio={provider.bio}
        yearsExperience={provider.years_experience}
        baseCity={provider.base_city}
        serviceRadiusKm={Number(provider.service_radius_km)}
        languages={profile?.spoken_languages ?? ["English"]}
      />
    </div>
  );
}
