import { cva, type VariantProps } from "class-variance-authority";

/**
 * The button's class recipe, kept out of `button.tsx`.
 *
 * `button.tsx` is a Client Component, and every export of a `"use client"`
 * module becomes a client reference — so a Server Component cannot call a
 * function imported from it. That matters because the most common thing to do
 * with these variants is dress a `next/link` as a button on a server-rendered
 * page, which is a link and not a button: an anchor nested inside a `<button>`
 * is invalid markup and does not navigate.
 *
 * Splitting the recipe out means the two share one definition instead of one
 * having a hand-copied approximation of the other.
 *
 * Notes that matter for how this feels:
 *  • `active:scale-[0.98]` on a 130ms out curve — the press must resolve before
 *    the user's finger lifts, or it reads as lag rather than as feedback.
 *  • min-h-11 everywhere. This app gets used one-handed, outdoors, often by
 *    someone already holding a toolbag.
 */
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "rounded-field select-none",
    "transition-[background-color,border-color,color,box-shadow,transform,opacity]",
    "duration-[var(--duration-instant)] ease-out-strong",
    "active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Default action. Green = the platform speaking. */
        primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800",
        /** Money. Deposits, payouts, "Pay GHS 448.00". Use sparingly. */
        money: "bg-accent-600 text-ink-950 shadow-sm hover:bg-accent-500",
        secondary:
          "bg-ink-0 text-ink-800 border border-ink-300 shadow-xs hover:bg-ink-50 hover:border-ink-400",
        ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
        danger: "bg-danger-600 text-white shadow-sm hover:bg-danger-700",
        link: "text-brand-700 underline-offset-4 hover:underline active:scale-100 h-auto min-h-0 p-0",
      },
      size: {
        sm: "min-h-9 px-3 text-sm [&_svg]:size-4",
        md: "min-h-11 px-4 text-[0.9375rem] [&_svg]:size-[1.125rem]",
        lg: "min-h-13 px-6 text-base [&_svg]:size-5",
        icon: "min-h-11 w-11 [&_svg]:size-5",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
