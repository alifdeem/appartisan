"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";

import { saveGhanaCardNumberAction } from "@/app/(app)/provider/actions";
import { Field, Input } from "@/components/ui/input";
import { formatGhanaCardNumber, isValidGhanaCardNumber } from "@/lib/providers/application";
import { cn } from "@/lib/utils";

/**
 * The Ghana Card PIN.
 *
 * **It saves on blur rather than behind a button.** Everything else on this
 * screen — three photographs — commits the moment it is taken, so a lone Save
 * button next to one text field would be the only thing on the page that has to
 * be pressed, and the one thing most likely to be left unpressed.
 *
 * **It formats as you type.** The number is printed on the card *with* the
 * dashes, so a field that silently requires them omitted, or silently requires
 * them included, produces a rejection for a data-entry reason on the one form
 * whose entire purpose is establishing trust. Typing ten digits is enough;
 * `GHA-` and both dashes appear on their own.
 *
 * **There is no "saved" state, and that is the point.** The `value` prop *is*
 * what the database holds: the action revalidates this route, so a successful
 * save re-renders the server component and arrives here as a new prop. Keeping
 * a local mirror and reconciling it against the action result in an effect
 * would be a second, laggier copy of a fact we are already being told — and it
 * would render the stale answer for a frame before correcting itself.
 *
 * The saved state is deliberately quiet: a tick that fades in inside the field.
 * A toast for a field that saves itself is a notification nobody asked for.
 */
export function GhanaCardField({ value }: { value: string | null }) {
  const [state, formAction, pending] = useActionState(saveGhanaCardNumberAction, null);

  const saved = value ?? "";
  const [text, setText] = React.useState(saved);
  const formRef = React.useRef<HTMLFormElement>(null);

  const normalised = text.trim().toUpperCase();
  const valid = isValidGhanaCardNumber(normalised);
  const dirty = normalised !== saved;

  // Held back until they have had a real chance to finish. Marking a
  // half-entered number as wrong while somebody is still entering it is the
  // classic inline-validation own goal.
  const showInvalid = dirty && normalised.length >= 15 && !valid;

  function commit() {
    if (!valid || !dirty || pending) return;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction}>
      <Field
        label="Ghana Card number"
        htmlFor="ghanaCardNumber"
        required
        error={
          state?.fieldErrors?.ghanaCardNumber ??
          (showInvalid
            ? "That is not complete yet — it ends in a single check digit, like GHA-123456789-0."
            : undefined)
        }
        hint="The number printed on the front of your card."
      >
        <div className="relative">
          <Input
            id="ghanaCardNumber"
            name="ghanaCardNumber"
            value={text}
            onChange={(event) => setText(formatGhanaCardNumber(event.target.value))}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            maxLength={15}
            placeholder="GHA-123456789-0"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={cn("tabular pr-10 font-mono", showInvalid && "border-danger-500")}
            aria-invalid={showInvalid || Boolean(state?.fieldErrors?.ghanaCardNumber)}
          />

          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center">
            {pending ? (
              <Loader2 className="size-4 animate-spin text-copy-muted" aria-hidden />
            ) : saved !== "" && !dirty ? (
              <Check
                className="size-4 animate-fade-in text-success-600"
                strokeWidth={3}
                aria-hidden
              />
            ) : null}
          </span>
        </div>
      </Field>

      {state?.error && (
        <p role="alert" className="mt-1.5 animate-fade-in text-sm text-danger-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
