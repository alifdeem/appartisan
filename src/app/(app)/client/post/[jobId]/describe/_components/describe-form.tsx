"use client";

import * as React from "react";
import { useActionState } from "react";
import { ArrowUpRight } from "lucide-react";

import { saveDescriptionAction } from "@/app/(app)/client/actions";
import { FieldLabel } from "@/components/mobile/field-label";
import { panelControlClasses } from "@/components/mobile/panel-field";
import { PhotoUploader } from "@/components/jobs/photo-uploader";
import { StickyAction } from "@/components/mobile/sticky-action";
import { TradeSwitcher } from "@/components/mobile/trade-switcher";
import { VoiceRecorder } from "@/components/jobs/voice-recorder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/lib/supabase/types";
import type { SignedPhoto } from "@/lib/jobs/queries";

const MAX_DESCRIPTION = 2000;

/**
 * Describing the problem — the reference's `@1-main` and `@3-after-filling-form`.
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
 *
 * **No card around it.** The reference's form screens put fields straight on the
 * white ground with a labelled rule between sections. A card here would be a
 * border drawn around the only thing on the screen, which is the audit's
 * "46 hand-rolled card surfaces" habit in miniature.
 *
 * **The character counter counts up, not down.** `2000 characters left` on an
 * empty box reads as a target to fill. It appears only in the last 200, where
 * it is information rather than pressure — the reference shows
 * `/Maximum 200 characters` permanently, which on a 2000-character field would
 * just be a wrong number.
 */
export function DescribeForm({
  jobId,
  categories,
  categoryId,
  initialDescription,
  photos,
  voiceNoteUrl,
  hasVoiceNote,
}: {
  jobId: string;
  categories: CategoryRow[];
  categoryId: string;
  initialDescription: string | null;
  photos: SignedPhoto[];
  voiceNoteUrl: string | null;
  hasVoiceNote: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveDescriptionAction, null);
  const [description, setDescription] = React.useState(initialDescription ?? "");

  const remaining = MAX_DESCRIPTION - description.length;
  const invalid = Boolean(state?.fieldErrors?.description);

  return (
    <>
      {/* Outside the description form on purpose: `<form>` cannot nest, and the
          switcher posts to its own action. */}
      <div className="mb-7 space-y-4">
        <div className="space-y-2">
          <h1 className="font-space text-title-sm font-bold text-balance text-navy-900">
            Post a job and match an artisan
          </h1>
          <p className="text-note leading-relaxed text-copy-muted">
            Describe what you need. We&rsquo;ll match you with a verified artisan near you — nothing
            is charged until you approve a price.
          </p>
        </div>

        <div className="space-y-2">
          <FieldLabel>Browse by category</FieldLabel>
          <TradeSwitcher jobId={jobId} categories={categories} selectedId={categoryId} />
        </div>
      </div>

      <form action={formAction} className="space-y-8">
      <input type="hidden" name="jobId" value={jobId} />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <FieldLabel as="label" htmlFor="description">
            Description
          </FieldLabel>

          {/* Only in the last 200 — see the note above. */}
          {description.length > MAX_DESCRIPTION - 200 && (
            <span
              className={cn(
                "tabular font-mono text-2xs",
                remaining < 40 ? "text-danger-600" : "text-copy-muted",
              )}
            >
              {remaining} left
            </span>
          )}
        </div>

        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value.slice(0, MAX_DESCRIPTION))}
          rows={5}
          maxLength={MAX_DESCRIPTION}
          placeholder="The kitchen tap has been dripping for about a week and now the cold water handle will not close fully."
          aria-invalid={invalid}
          aria-describedby={invalid ? "description-error" : undefined}
          // Shares `panelControlClasses` with every field in the flow, so the
          // textarea and the landmark input cannot drift a pixel apart.
          className={panelControlClasses(invalid, "resize-y")}
        />

        {invalid && (
          <p id="description-error" role="alert" className="text-note text-danger-600">
            {state?.fieldErrors?.description}
          </p>
        )}
      </div>

      <section className="space-y-2.5 border-t border-hairline pt-6">
        <div className="space-y-1">
          <h2 className="font-space text-note font-bold text-navy-900">Photos</h2>
          <p className="text-note leading-relaxed text-copy-muted">
            A picture of the fault answers half the questions an artisan would otherwise have to
            ask on the phone.
          </p>
        </div>

        <PhotoUploader jobId={jobId} photos={photos} />
      </section>

      <section className="space-y-2.5 border-t border-hairline pt-6">
        <div className="space-y-1">
          <h2 className="font-space text-note font-bold text-navy-900">
            Voice note
            <span className="ml-1.5 font-sans text-2xs font-normal text-copy-muted">
              instead of writing, if you prefer
            </span>
          </h2>
          <p className="text-note leading-relaxed text-copy-muted">
            Explain it in your own words — in any language. Your artisan will hear it exactly as
            you said it.
          </p>
        </div>

        <VoiceRecorder jobId={jobId} existingUrl={voiceNoteUrl} hasRecording={hasVoiceNote} />
      </section>

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
    </>
  );
}
