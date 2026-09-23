import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        // The sweep from the old palette mapped three of these onto the same
        // azure tint, which made neutral, brand and info identical. Pulled
        // apart again: neutral is quiet, brand is the filled primary marker,
        // money is navy because navy is money everywhere in this system.
        neutral: "bg-azure-50 text-copy-muted",
        brand: "bg-navy-800 text-white",
        money: "bg-navy-50 text-navy-900",
        success: "bg-success-50 text-success-700",
        warning: "bg-warning-50 text-warning-700",
        danger: "bg-danger-50 text-danger-700",
        info: "bg-azure-100 text-azure-700",
      },
      outline: {
        true: "bg-transparent ring-1 ring-inset",
      },
    },
    compoundVariants: [
      { tone: "neutral", outline: true, class: "ring-hairline text-copy-muted" },
      { tone: "brand", outline: true, class: "ring-navy-300 text-navy-900" },
      { tone: "money", outline: true, class: "ring-navy-200 text-navy-800" },
      { tone: "success", outline: true, class: "ring-success-500/40 text-success-700" },
      { tone: "warning", outline: true, class: "ring-warning-500/40 text-warning-700" },
      { tone: "danger", outline: true, class: "ring-danger-500/40 text-danger-700" },
      { tone: "info", outline: true, class: "ring-azure-500/40 text-azure-700" },
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
