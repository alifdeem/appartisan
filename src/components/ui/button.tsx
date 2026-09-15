"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { buttonVariants, type ButtonVariantProps } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * The one button.
 *
 * The class recipe lives in `./button-variants` so Server Components can dress a
 * `next/link` in it without importing this client module — see the note there.
 *
 * Loading swaps the label for a spinner but preserves the button's width, so
 * nothing around it reflows mid-tap.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  block,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="relative inline-flex items-center justify-center gap-2">
          <Loader2 className="absolute animate-spin" aria-hidden />
          {/* Holds the box at its resting width while the label is hidden. */}
          <span aria-hidden className="invisible contents">
            {children}
          </span>
          <span className="sr-only">Working…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export { buttonVariants };
