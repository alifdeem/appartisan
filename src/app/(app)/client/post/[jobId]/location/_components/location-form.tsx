"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";

import { saveLocationAction } from "@/app/(app)/client/actions";
import { LocationPicker } from "@/components/jobs/location-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="jobId" value={jobId} />

      <Card>
        <CardContent>
          <LocationPicker
            initialPoint={initialPoint}
            initialAddress={initialAddress}
            initialLandmark={initialLandmark}
            initialGhanaPost={initialGhanaPost}
            fieldErrors={state?.fieldErrors}
          />
        </CardContent>
      </Card>

      {state?.error && (
        <p role="alert" className="animate-fade-in text-sm text-danger-600">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={pending}>
          Continue
          <ArrowRight />
        </Button>
      </div>
    </form>
  );
}
