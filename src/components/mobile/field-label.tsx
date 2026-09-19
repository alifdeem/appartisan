import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The tiny letter-spaced uppercase label that sits above a group.
 *
 * `CONTINUE WITH YOUR PHONE NUMBER`, `MORE WAYS TO SIGN UP`, `USER NAME`.
 *
 * The `frontend-design` skill lists tracked-out all-caps eyebrow labels as one
 * of the commonest tells of a generated page, and in general it is right. It is
 * kept here deliberately: it is a signature detail of the reference we were
 * asked to match, and that skill's own rule is that a brief which pins a
 * direction wins. See `redesign/newredesign-reference-rules.md` §3 — this is
 * not an oversight and should not be "fixed".
 *
 * Renders a `<span>` by default. Pass `as="label"` with `htmlFor` when it
 * actually labels a field, so it stays a real label rather than decoration that
 * merely looks like one.
 */
export function FieldLabel({
  children,
  as: Component = "span",
  className,
  ...props
}: {
  children: React.ReactNode;
  as?: "span" | "label" | "legend";
  className?: string;
} & React.HTMLAttributes<HTMLElement> & { htmlFor?: string }) {
  return (
    <Component
      className={cn(
        "block text-2xs font-medium tracking-[0.07em] text-ink-500 uppercase",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
