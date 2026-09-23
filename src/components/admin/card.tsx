import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The console's surface, built on shadcn/ui's Card.
 *
 * **Vendored, not installed, and the tokens are ours.** shadcn is copy-owned
 * code rather than a dependency, which is the point of it. Its own Card is
 * `bg-card text-card-foreground border shadow-sm` on the
 * `--background / --card / --muted-foreground / --primary` token set. This
 * project has none of those: it has `navy-*`, `azure-*`, `canvas`, `hairline`
 * and `copy`, set in `@theme` in `globals.css`. Running `shadcn init` would
 * write a second, parallel token system into that file and pull Radix in
 * alongside `@base-ui/react`, leaving the app with two of everything.
 *
 * So what is taken is the part worth taking: the composition. A card that is
 * a family of slots rather than one component with a `title` prop, `data-slot`
 * attributes so a parent can style its children without prop-drilling, and the
 * header's container query, which is what lets the same card sit in a narrow
 * column and a wide one without a breakpoint for each.
 *
 * The one deliberate divergence from upstream: `CardHeader` carries a bottom
 * rule. At this density a header that is separated only by space stops reading
 * as a header once the content under it is a table.
 */

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col rounded-[1.25rem] border border-hairline bg-white text-copy shadow-[var(--shadow-float)]",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1",
        "border-b border-hairline px-5 py-4",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * An `h2`, where upstream ships a `div`.
 *
 * shadcn leaves this unsemantic so the consumer can choose, and the choice
 * here is not really open: on this console every card is a section of the
 * page, under the page's single `h1`. Left as a `div` the overview jumped
 * `h1` to `h3` (the ledger's column headings), which the accessibility check
 * caught and which is invisible to the eye.
 */
function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="card-title"
      className={cn("font-space text-ui leading-none font-bold text-navy-900", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-note text-copy-muted", className)}
      {...props}
    />
  );
}

/** The top-right slot: a filter, a link out, a count. */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-center justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex flex-1 flex-col justify-center px-5 py-4", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-3 border-t border-hairline px-5 py-3", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter };
