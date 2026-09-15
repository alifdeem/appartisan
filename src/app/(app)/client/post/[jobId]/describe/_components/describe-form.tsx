"use client";

import * as React from "react";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";

import { saveDescriptionAction } from "@/app/(app)/client/actions";
import { PhotoUploader } from "@/components/jobs/photo-uploader";
import { VoiceRecorder } from "@/components/jobs/voice-recorder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SignedPhoto } from "@/lib/jobs/queries";

const MAX_DESCRIPTION = 2000;

/**
 * Describing the problem.
 *
 * Three inputs, deliberately equal in standing: written description, photos,
 * voice note. The database accepts a description *or* a voice note as
 * sufficient (`post_job`, migration 0007), and this screen says so plainly
 * rather than marking the textarea required and burying the alternative.
 *
 * The photo uploader and the recorder write to the draft immediately through
 * their own actions — they are not part of this form's submission. That is why
 * a client can lose their connection halfway through and come back to find the
 * four photographs they already uploaded still attached.
 */
export function DescribeForm({
  jobId,
  initialDescription,
  photos,
  voiceNoteUrl,
  hasVoiceNote,
}: {
  jobId: string;
  initialDescription: string | null;
  photos: SignedPhoto[];
  voiceNoteUrl: string | null;
  hasVoiceNote: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveDescriptionAction, null);
  const [description, setDescription] = React.useState(initialDescription ?? "");

  const remaining = MAX_DESCRIPTION - description.length;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="jobId" value={jobId} />

      <Card>
        <CardContent className="space-y-5">
          <Field
            label="What is the problem?"
            htmlFor="description"
            hint="The more specific you are, the closer the artisan's price will be. Mention what it is, where it is, and how long it has been happening."
            error={state?.fieldErrors?.description}
          >
            <Textarea
              id="description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, MAX_DESCRIPTION))}
              rows={5}
              maxLength={MAX_DESCRIPTION}
              placeholder="The kitchen tap has been dripping for about a week and now the cold water handle will not close fully."
              aria-invalid={Boolean(state?.fieldErrors?.description)}
            />
          </Field>

          {description.length > MAX_DESCRIPTION - 200 && (
            <p
              className={cn(
                "tabular -mt-3 text-right font-mono text-xs",
                remaining < 40 ? "text-danger-600" : "text-ink-500",
              )}
            >
              {remaining} characters left
            </p>
          )}

          <div className="space-y-2.5 border-t border-ink-200 pt-5">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium text-ink-800">Photos</h2>
              <p className="text-sm text-ink-500">
                A picture of the fault answers half the questions an artisan would otherwise
                have to ask on the phone.
              </p>
            </div>

            <PhotoUploader jobId={jobId} photos={photos} />
          </div>

          <div className="space-y-2.5 border-t border-ink-200 pt-5">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium text-ink-800">
                Voice note
                <span className="ml-1.5 text-xs font-normal text-ink-400">
                  instead of writing, if you prefer
                </span>
              </h2>
              <p className="text-sm text-ink-500">
                Explain it in your own words — in any language. Your artisan will hear it exactly
                as you said it.
              </p>
            </div>

            <VoiceRecorder
              jobId={jobId}
              existingUrl={voiceNoteUrl}
              hasRecording={hasVoiceNote}
            />
          </div>
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
