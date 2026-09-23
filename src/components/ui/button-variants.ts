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
    "select-none",
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
        primary: "bg-navy-800 text-white shadow-sm hover:bg-navy-900",
        /**
         * The 2026 reference's primary action: a navy gradient with a navy
         * bloom under it, lifting 1px on hover before it presses back down.
         *
         * The gradient runs navy-800 → navy-900 top-to-bottom, which is only
         * about 7% of lightness. That restraint is the point — a gradient you
         * can *see* on a button reads as 2013. This one is only there so the
         * top edge catches light and the shape looks moulded rather than
         * filled.
         *
         * The lift is `-translate-y-px` on hover and nothing on active, so the
         * press returns it to the resting plane. Combined with the 130ms
         * instant curve the button feels like it has mass.
         */
        navy: [
          "bg-linear-to-b from-navy-800 to-navy-900 text-white",
          "shadow-[var(--shadow-glow-navy)]",
          "hover:-translate-y-px hover:shadow-[var(--shadow-glow-navy-lg)]",
          "active:translate-y-0 active:shadow-[var(--shadow-glow-navy)]",
        ].join(" "),
        /**
         * Its outlined partner — "Create an account" under the OR rule. Azure
         * border on white, filling with the soft tint on hover. No shadow: it
         * must read as the quieter of the two at a glance, and two shadowed
         * buttons stacked read as two primaries.
         */
        navyOutline: [
          "bg-white text-navy-800 border border-hairline",
          "hover:border-azure-500 hover:bg-azure-50",
        ].join(" "),
        /** Money. Deposits, payouts, "Pay GHS 448.00". Use sparingly. */
        money: "bg-navy-800 text-navy-950 shadow-sm hover:bg-navy-700",
        secondary:
          "bg-white text-navy-900 border border-hairline shadow-xs hover:bg-canvas hover:border-copy-muted",
        /**
         * The new-reference secondary. Every screen in that redesign grounds on
         * pure white, where `secondary`'s warm `white` fill reads as a faint
         * stain rather than as a surface. No shadow either — the reference's
         * outlined buttons are flat, and depth there comes from the border.
         */
        outline:
          "bg-white text-navy-900 border border-hairline hover:bg-canvas hover:border-hairline",
        ghost: "text-copy hover:bg-azure-50 hover:text-navy-900",
        danger: "bg-danger-600 text-white shadow-sm hover:bg-danger-700",
        link: "text-navy-800 underline-offset-4 hover:underline active:scale-100 h-auto min-h-0 p-0",
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
      /**
       * `rect` is the app's existing 0.625rem field radius and stays the
       * default, so nothing already built moves. `pill` is the new-reference
       * shape — every primary action in those mockups is fully rounded.
       */
      shape: {
        rect: "rounded-field",
        pill: "rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md", shape: "rect" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
