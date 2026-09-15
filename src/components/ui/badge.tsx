import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "bg-ink-100 text-ink-700",
        brand: "bg-brand-50 text-brand-800",
        money: "bg-accent-50 text-accent-800",
        success: "bg-success-50 text-success-700",
        warning: "bg-warning-50 text-warning-700",
        danger: "bg-danger-50 text-danger-700",
        info: "bg-info-50 text-info-700",
      },
      outline: {
        true: "bg-transparent ring-1 ring-inset",
      },
    },
    compoundVariants: [
      { tone: "neutral", outline: true, class: "ring-ink-300 text-ink-700" },
      { tone: "brand", outline: true, class: "ring-brand-300 text-brand-800" },
      { tone: "money", outline: true, class: "ring-accent-300 text-accent-800" },
      { tone: "success", outline: true, class: "ring-success-500/40 text-success-700" },
      { tone: "warning", outline: true, class: "ring-warning-500/40 text-warning-700" },
      { tone: "danger", outline: true, class: "ring-danger-500/40 text-danger-700" },
      { tone: "info", outline: true, class: "ring-info-500/40 text-info-700" },
    ],
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  outline,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, outline }), className)} {...props} />;
}

/**
 * The simulation marker.
 *
 * Every screen that would have moved money or sent a message in production
 * carries one of these. It is not decoration — it is the thing that stops the
 * client, or me, from believing a demo transaction was real. PLAN.md §3.
 */
export function SimulatedBadge({ className, label = "Simulated" }: { className?: string; label?: string }) {
  return (
    <Badge
      tone="warning"
      outline
      className={cn("border-dashed", className)}
      title="No real money or messages moved. This is a simulated integration."
    >
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-warning-500" />
        <span className="relative inline-flex size-1.5 rounded-full bg-warning-500" />
      </span>
      {label}
    </Badge>
  );
}
