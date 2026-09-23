import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui's Table, on this project's tokens.
 *
 * Kept almost verbatim, because the parts that matter here are structural
 * rather than visual: the scroll container that stops a wide table forcing the
 * page sideways, `whitespace-nowrap` on cells so a long landmark truncates
 * instead of rewrapping every row to a different height, and the `[&_tr]`
 * descendant selectors that put the row rules in one place.
 *
 * Changed from upstream: `hover:bg-muted/50` becomes `hover:bg-azure-50/60`,
 * and rows are separated by `hairline` rather than `border`. Cell padding goes
 * up from `p-2`, which is tuned for a much denser default than this console
 * wants.
 */

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-note", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b [&_tr]:border-hairline", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-hairline transition-colors duration-[var(--duration-instant)]",
        "hover:bg-azure-50/60 data-[state=selected]:bg-azure-50",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 px-3 text-left align-middle text-2xs font-semibold tracking-[0.04em] whitespace-nowrap text-copy-muted uppercase",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-3 py-2.5 align-middle whitespace-nowrap", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption data-slot="table-caption" className={cn("mt-3 text-note text-copy-muted", className)} {...props} />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption };
