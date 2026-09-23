"use client";

import { OTPInput, type SlotProps } from "input-otp";

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
        // `flex-1 min-w-0`, not a fixed width. Six 44px boxes plus their gaps
        // and a separator came to 320px, inside a card whose inner width at a
        // 360px viewport is 264 — the row ran off the screen. Now the boxes
        // divide whatever width they are given, so the field fits its container
        // at every size instead of at one.
        "relative flex h-14 min-w-0 flex-1 items-center justify-center",
        // Recoloured for the 2026 auth reference: azure focus, navy digits, the
        // same hairline the card's fields use. The OTP is only ever rendered
        // inside the auth card, so it takes that palette rather than carrying a
        // `tone` prop for a second context that does not exist.
        "rounded-[0.875rem] border bg-white text-lg font-semibold tabular text-navy-900 sm:text-xl",
        "transition-[border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-out-strong",
        isActive
          ? "z-10 -translate-y-0.5 border-azure-500 ring-4 ring-azure-500/12"
          : "border-hairline",
        // A filled box that is not the active one still has to read as filled —
        // otherwise a completed code looks like six empty boxes with digits
        // floating in them.
        char && !isActive && "border-azure-300",
      )}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-px animate-caret-blink bg-navy-900" />
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
        "flex w-full items-center gap-1.5 has-[:disabled]:opacity-50 sm:gap-2.5",
        className,
      )}
      render={({ slots }) => (
        <>
          {slots.map((slot, index) => (
            <Slot key={index} {...slot} />
          ))}
        </>
      )}
    />
  );
}
