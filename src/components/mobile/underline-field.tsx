import * as React from "react";

import { FieldLabel } from "@/components/mobile/field-label";
import { cn } from "@/lib/utils";

/**
 * The reference's field: a tiny letter-spaced label, the value on white, and a
 * hairline rule underneath. No box, no fill, no rounded corners.
 *
 * Why it is a different primitive rather than a variant of `Input`: the boxed
 * field in `ui/input.tsx` is correct everywhere it is already used — the admin
 * console, the quote builder, the settings screen — where a form is a dense
 * grid and the box is what separates one control from its neighbour. These
 * screens are the opposite: one question at a time on an empty white page,
 * where a box draws a border around something that has nothing to be separated
 * from. Changing `Input` would drag 40-odd existing fields along with it.
 *
 * The rule carries the focus state, because it is the only structure on screen
 * — a focus ring around an invisible box lands nowhere.
 *
 * **Error is not a red asterisk.** The reference marks nothing as required and
 * neither does this; the fields on these screens are all required, so an
 * asterisk on every one of them is decoration. A problem is stated in words
 * under the rule, where the answer is.
 */
export function UnderlineField({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  /** Shown under the rule when there is no error. */
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <FieldLabel as="label" htmlFor={htmlFor}>
        {label}
      </FieldLabel>

      <div
        className={cn(
          "flex items-center gap-2 border-b pb-1.5 transition-colors",
          // `focus-within` rather than a ring: the rule IS the field here.
          error
            ? "border-danger-500 focus-within:border-danger-600"
            : "border-ink-200 focus-within:border-ink-900",
        )}
      >
        {children}
      </div>

      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="animate-fade-in text-note text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-note text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * The control that goes inside it. Transparent, no border of its own, no
 * padding — the field owns all three. `text-base` on purpose: iOS Safari zooms
 * the viewport when a focused input is under 16px, which on a one-field screen
 * throws the whole layout sideways.
 */
export function UnderlineInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "min-h-11 w-full min-w-0 bg-transparent text-base text-ink-900",
        "placeholder:text-ink-400 focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
