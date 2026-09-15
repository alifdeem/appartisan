"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * Toasts.
 *
 * Bottom-centre everywhere. On a phone that is where the thumb is and where a
 * top-anchored toast would collide with the status bar; on desktop it is the
 * one corner nothing else in this product occupies, and keeping a single
 * position means a toast never appears somewhere the user has not already
 * learned to look. Sonner handles swipe-to-dismiss and stacking, which is most
 * of why it is here rather than a hand-rolled one.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      offset={16}
      gap={10}
      duration={4200}
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-card !border-ink-200 !bg-ink-0 !shadow-lg !text-ink-900 !font-sans !gap-3",
          title: "!text-sm !font-medium",
          description: "!text-sm !text-ink-600",
          actionButton: "!bg-brand-700 !text-white !rounded-field !font-medium",
          cancelButton: "!bg-ink-100 !text-ink-700 !rounded-field",
          error: "!text-danger-700",
          success: "!text-success-700",
        },
      }}
    />
  );
}
