"use client";

import { OTPInput, type SlotProps } from "input-otp";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Six-digit code entry.
 *
 * `input-otp` renders one real input behind the slots, which is what makes iOS
 * SMS autofill and password-manager autofill work at all — a row of six
 * separate inputs breaks both. Worth the dependency.
 *
 * The library offers two mutually exclusive APIs: a `render` prop that is
 * handed the slot state, or `children` that read it from `OTPInputContext`.
 * Only the `children` path is wrapped in the provider, so combining `render`
 * with a context-reading child gets the context's empty default and crashes on
 * `slots[index]`. Slot state is therefore passed down as a plain prop.
 */

function Slot({ char, hasFakeCaret, isActive }: SlotProps) {
  return (
    <div
      className={cn(
        "relative flex h-14 w-11 items-center justify-center sm:w-12",
        // White, not `ink-0`. These sit on the pure-white auth ground, where the
        // warm fill reads as a smudge — the same reason the `outline` button
        // variant exists. Everywhere else the component is on `ink-25`, where
        // white is still the correct raised surface.
        "rounded-field border bg-white text-xl font-semibold tabular text-ink-900",
        "transition-[border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-out-strong",
        isActive
          ? "z-10 -translate-y-0.5 border-brand-600 ring-4 ring-brand-600/12"
          : "border-ink-300",
        char && !isActive && "border-ink-400",
      )}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-px animate-caret-blink bg-ink-900" />
        </div>
      )}
    </div>
  );
}

export function OtpField({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = true,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <OTPInput
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      autoFocus={autoFocus}
      inputMode="numeric"
      pattern="^\d*$"
      // Lets iOS offer the code straight from the SMS notification.
      autoComplete="one-time-code"
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-50 sm:gap-2.5",
        className,
      )}
      render={({ slots }) => (
        <>
          {slots.map((slot, index) => (
            <React.Fragment key={index}>
              <Slot {...slot} />
              {index === 2 && <div className="mx-0.5 h-px w-3 rounded-full bg-ink-300" />}
            </React.Fragment>
          ))}
        </>
      )}
    />
  );
}
