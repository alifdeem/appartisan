"use client";

import { useActionState } from "react";
import { ArrowUpRight } from "lucide-react";

import { saveLocationAction } from "@/app/(app)/client/actions";
import { LocationPicker } from "@/components/jobs/location-picker";
import { StickyAction } from "@/components/mobile/sticky-action";
import { Button } from "@/components/ui/button";
import type { LatLng } from "@/lib/integrations/maps/types";

export function LocationForm({
  jobId,
  initialPoint,
  initialAddress,
  initialLandmark,
  initialGhanaPost,
}: {
  jobId: string;
  initialPoint: LatLng | null;
  initialAddress: string | null;
  initialLandmark: string | null;
  initialGhanaPost: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveLocationAction, null);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="jobId" value={jobId} />

      {/* No card. The picker is the whole screen — a border around it would be
          a box drawn around the only content, which is the habit the audit
          counted 46 instances of. */}
      <LocationPicker
        initialPoint={initialPoint}
        initialAddress={initialAddress}
        initialLandmark={initialLandmark}
        initialGhanaPost={initialGhanaPost}
        fieldErrors={state?.fieldErrors}
      />

      {state?.error && (
        <p role="alert" className="animate-fade-in text-note text-danger-600">
          {state.error}
        </p>
      )}

      <StickyAction>
        <Button type="submit" variant="navy" size="lg" shape="pill" block loading={pending}>
          Continue
          <ArrowUpRight />
        </Button>
      </StickyAction>
    </form>
  );
}
