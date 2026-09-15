import type { Metadata } from "next";
import { BadgeCheck, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RoadmapPanel } from "@/components/app/roadmap-panel";
import { Stat } from "@/components/app/stat";
import { formatCedis } from "@/lib/money";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { VerificationStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "My work" };

const VERIFICATION_COPY: Record<
  VerificationStatus,
  { tone: "neutral" | "warning" | "success" | "danger"; label: string; body: string }
> = {
  unsubmitted: {
    tone: "warning",
    label: "Not verified",
    body: "Upload your Ghana Card and a selfie so an admin can verify you. You cannot receive job offers until you are approved.",
  },
  pending: {
    tone: "warning",
    label: "Under review",
    body: "Your documents are with our team. We may call you to confirm a few details before approving your account.",
  },
  approved: {
    tone: "success",
    label: "Verified",
    body: "You are approved and can receive job offers in your service area.",
  },
  rejected: {
    tone: "danger",
    label: "Not approved",
    body: "We could not verify your documents. Contact support to find out what is needed.",
  },
  suspended: {
    tone: "danger",
    label: "Suspended",
    body: "Your account is suspended and will not receive offers. Contact support.",
  },
};

export default async function ProviderDashboard() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: provider } = await supabase
    .from("providers")
    .select("verification_status, availability, rating_avg, rating_count, jobs_completed")
    .eq("profile_id", profile!.id)
    .maybeSingle();

  const status = (provider?.verification_status ?? "unsubmitted") as VerificationStatus;
  const copy = VERIFICATION_COPY[status];
  const firstName = profile?.full_name.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink-900">Hello, {firstName}</h1>
        <p className="text-[0.9375rem] text-ink-600">
          Your work, your earnings, and your verification status.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-4">
          <span
            className={
              status === "approved"
                ? "grid size-11 shrink-0 place-items-center rounded-full bg-success-50 text-success-700"
                : "grid size-11 shrink-0 place-items-center rounded-full bg-warning-50 text-warning-700"
            }
          >
            {status === "approved" ? (
              <BadgeCheck className="size-5" />
            ) : (
              <ShieldAlert className="size-5" />
            )}
          </span>

          <div className="min-w-[16rem] flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-ink-900">Verification</h2>
              <Badge tone={copy.tone}>{copy.label}</Badge>
            </div>
            <p className="text-sm leading-relaxed text-ink-600">{copy.body}</p>
          </div>

          {status === "unsubmitted" && (
            <Button variant="secondary" disabled title="Document upload arrives in Phase 1">
              Start verification
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Jobs completed" value={String(provider?.jobs_completed ?? 0)} />
        <Stat
          label="Rating"
          value={
            provider && provider.rating_count > 0
              ? `${Number(provider.rating_avg).toFixed(1)} ★`
              : "—"
          }
          note={provider?.rating_count ? `${provider.rating_count} ratings` : "No ratings yet"}
        />
        <Stat label="Paid out" value={formatCedis(0)} note="Lifetime earnings" />
      </div>

      <RoadmapPanel
        title="What's coming to this screen"
        description="Phase 0 delivers the foundations. These are the pieces that land on top."
        items={[
          { label: "Upload Ghana Card, selfie and certificates", phase: "Phase 1" },
          { label: "Go online and receive job offers", phase: "Phase 3" },
          { label: "Build and send a quote", phase: "Phase 3" },
          { label: "Track earnings and payout history", phase: "Phase 4" },
          { label: "Navigate to the job and share live location", phase: "Phase 5" },
        ]}
      />
    </div>
  );
}
