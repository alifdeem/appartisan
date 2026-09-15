"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check } from "lucide-react";

import { saveAboutAction } from "@/app/(app)/provider/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  MAX_BIO_LENGTH,
  MIN_BIO_LENGTH,
  SERVICE_RADIUS_OPTIONS,
  SPOKEN_LANGUAGES,
} from "@/lib/providers/application";
import { cn } from "@/lib/utils";

/**
 * The part of the application a client actually reads.
 *
 * Three decisions worth defending:
 *
 *  • **The bio counter counts up to the minimum, not down from the maximum.**
 *    Nobody writing two sentences about fixing air conditioners is at risk of
 *    600 characters. The real risk is a four-word bio, so the counter's job is
 *    to say "keep going", and it stops being a counter the moment it is
 *    satisfied.
 *
 *  • **Service radius is four buttons, not a slider or a number.** The honest
 *    answer is a judgement about traffic, not a measurement, and these are the
 *    bands the matcher widens through anyway (PLAN.md §6). A slider invites
 *    precision that does not exist.
 *
 *  • **Languages are here rather than at signup only.** PLAN.md §2 makes them a
 *    filter clients can use — "I want someone who speaks Twi" — so they are part
 *    of how an artisan is found, not a profile nicety.
 */
export function AboutForm({
  bio,
  yearsExperience,
  baseCity,
  serviceRadiusKm,
  languages: initialLanguages,
}: {
  bio: string | null;
  yearsExperience: number | null;
  baseCity: string | null;
  serviceRadiusKm: number;
  languages: string[];
}) {
  const [state, formAction, pending] = useActionState(saveAboutAction, null);

  const [bioText, setBioText] = React.useState(bio ?? "");
  const [radius, setRadius] = React.useState(() =>
    (SERVICE_RADIUS_OPTIONS as readonly number[]).includes(serviceRadiusKm)
      ? serviceRadiusKm
      : 10,
  );
  const [languages, setLanguages] = React.useState<Set<string>>(
    () => new Set(initialLanguages.length > 0 ? initialLanguages : ["English"]),
  );

  const bioLength = bioText.trim().length;
  const bioShort = bioLength < MIN_BIO_LENGTH;

  function toggleLanguage(language: string) {
    setLanguages((current) => {
      const next = new Set(current);
      if (next.has(language)) next.delete(language);
      else next.add(language);
      // English is the interface language and the fallback the server applies
      // anyway; letting somebody deselect everything just produces a surprise.
      if (next.size === 0) next.add("English");
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-5">
      <Field
        label="About your work"
        htmlFor="bio"
        required
        error={state?.fieldErrors?.bio}
        hint="What you fix, what you are known for, how long you have been doing it."
      >
        <Textarea
          id="bio"
          name="bio"
          value={bioText}
          onChange={(event) => setBioText(event.target.value)}
          maxLength={MAX_BIO_LENGTH}
          rows={5}
          placeholder="I fix and install air conditioners — split units and window units. Eight years, mostly around Tema and Spintex. I carry my own gas and vacuum pump."
          aria-invalid={Boolean(state?.fieldErrors?.bio)}
        />
      </Field>

      {/* Sits under the field, replacing the hint's slot rather than adding a
          row — so the layout does not jump the moment it turns green. */}
      <p
        className={cn(
          "-mt-3.5 flex items-center gap-1.5 text-xs transition-colors duration-[var(--duration-base)]",
          bioShort ? "text-ink-500" : "text-success-700",
        )}
      >
        {!bioShort && <Check className="size-3.5 animate-fade-in" strokeWidth={3} aria-hidden />}
        <span className="tabular font-mono">
          {bioShort ? `${bioLength}/${MIN_BIO_LENGTH}` : `${bioLength}`}
        </span>
        {bioShort ? "characters — keep going" : "that's enough to go on"}
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Years doing this work"
          htmlFor="yearsExperience"
          required
          error={state?.fieldErrors?.yearsExperience}
        >
          <Input
            id="yearsExperience"
            name="yearsExperience"
            type="number"
            inputMode="numeric"
            min={0}
            max={70}
            defaultValue={yearsExperience ?? ""}
            placeholder="8"
            className="tabular font-mono"
            aria-invalid={Boolean(state?.fieldErrors?.yearsExperience)}
          />
        </Field>

        <Field
          label="Where you work from"
          htmlFor="baseCity"
          required
          hint="Your base, not every area you cover."
          error={state?.fieldErrors?.baseCity}
        >
          <Input
            id="baseCity"
            name="baseCity"
            defaultValue={baseCity ?? ""}
            maxLength={80}
            placeholder="Tema Community 5"
            aria-invalid={Boolean(state?.fieldErrors?.baseCity)}
          />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-800">
          How far will you travel?
          <span className="ml-0.5 text-danger-600" aria-hidden>
            *
          </span>
        </legend>
        <input type="hidden" name="serviceRadiusKm" value={radius} />

        <div className="grid grid-cols-4 gap-2">
          {SERVICE_RADIUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRadius(option)}
              aria-pressed={radius === option}
              className={cn(
                "min-h-12 rounded-field border text-sm font-medium",
                "transition-[border-color,background-color,color,transform] duration-[var(--duration-fast)] ease-out-strong",
                "active:scale-[0.98]",
                radius === option
                  ? "border-brand-600 bg-brand-50 text-brand-900 ring-1 ring-brand-600"
                  : "border-ink-300 bg-ink-0 text-ink-700 hover:border-ink-400",
              )}
            >
              <span className="tabular font-mono">{option}</span> km
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-500">
          Jobs further than this will not be offered to you. You can change it any time.
        </p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-800">Languages you speak</legend>
        <input type="hidden" name="languages" value={[...languages].join(",")} />

        <div className="flex flex-wrap gap-2">
          {SPOKEN_LANGUAGES.map((language) => {
            const on = languages.has(language);
            return (
              <button
                key={language}
                type="button"
                onClick={() => toggleLanguage(language)}
                aria-pressed={on}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
                  "transition-[border-color,background-color,color,transform] duration-[var(--duration-fast)] ease-out-strong",
                  "active:scale-[0.97]",
                  on
                    ? "border-brand-600 bg-brand-50 text-brand-900"
                    : "border-ink-300 bg-ink-0 text-ink-700 hover:border-ink-400",
                )}
              >
                {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                {language}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-ink-500">
          Clients can ask for an artisan who speaks their language. This is how they find you.
        </p>
      </fieldset>

      {state?.error && (
        <p role="alert" className="animate-fade-in text-sm text-danger-600">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending}>
        Continue
      </Button>
    </form>
  );
}
