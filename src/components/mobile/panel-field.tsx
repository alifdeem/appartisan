import * as React from "react";

import { FieldLabel } from "@/components/mobile/field-label";
import { cn } from "@/lib/utils";

/**
 * A form field on the 2026 reference's white ground.
 *
 * The app already has `Field` and `Input` in `components/ui`, and they stay —
 * they are correct in the admin console and the quote builder, where a form is
 * a dense grid and the boxed, warm-filled control is what separates one input
 * from its neighbour. These screens are the opposite: one question on an empty
 * page, on pure white, in the navy palette. The `ink-0` fill reads as a stain
 * there, and `rounded-field` is half the radius everything around it uses.
 *
 * Rather than adding a variant to `Input` and dragging forty existing fields
 * along behind it, the new look is its own pair — the same decision, and the
 * same reasoning, as `UnderlineField` on the auth screens.
 *
 * **No red asterisk.** A required field is marked by saying nothing; the
 * optional ones say "optional". An asterisk is a symbol that has to be learned,
 * it is usually the only red on an untouched form, and a screen reader reads it
 * as "star". Same rule the auth screens follow.
 */

/**
 * The control's own classes, exported so a `<textarea>` or a third-party input
 * can wear the same skin without being wrapped in `PanelInput`.
 *
 * `text-base` (16px) is load-bearing: iOS zooms the whole page when a focused
 * field is smaller, and the zoom does not undo.
 */
export const panelControl = [
  "w-full rounded-[1.25rem] border bg-white px-4 py-3.5 text-base text-navy-900",
  "placeholder:text-copy-muted/70",
  "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-out-strong",
  "focus:ring-4 focus:ring-azure-500/15 focus:outline-none",
  "disabled:opacity-60",
].join(" ");

export function panelControlClasses(invalid?: boolean, className?: string) {
  return cn(
    panelControl,
    invalid ? "border-danger-500 focus:border-danger-500" : "border-hairline focus:border-azure-500",
    className,
  );
}

export function PanelField({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  /** Helper text under the control. Hidden while an error is showing. */
  hint?: string;
  error?: string;
  /** Marks the field optional. Required fields are simply not marked. */
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <FieldLabel as={htmlFor ? "label" : "span"} htmlFor={htmlFor}>
        {label}
        {optional && (
          <span className="ml-1.5 tracking-normal normal-case opacity-70">optional</span>
        )}
      </FieldLabel>

      {children}

      {/* The error replaces the hint rather than stacking under it — two lines
          of small grey-and-red text under one control is a paragraph nobody
          finishes, and the hint has already been read by the time it fails. */}
      {error ? (
        <p role="alert" className="text-note leading-relaxed text-danger-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-note leading-relaxed text-copy-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function PanelInput({
  invalid,
  className,
  ...props
}: React.ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={panelControlClasses(invalid, className)}
    />
  );
}
