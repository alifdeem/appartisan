import { cn } from "@/lib/utils";

/**
 * A labelled quantity.
 *
 * Mono and `tabular` without exception: these sit in columns, and proportional
 * digits make a column of numbers impossible to compare down its length.
 */
export function Figure({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "muted" | "positive" | "warning" | "danger";
}) {
  return (
    <div>
      <dt className="text-note text-copy-muted">{label}</dt>
      <dd
        className={cn(
          "tabular mt-1 font-mono text-title-sm font-semibold",
          tone === "default" && "text-navy-900",
          tone === "muted" && "text-copy-muted",
          tone === "positive" && "text-success-700",
          tone === "warning" && "text-warning-700",
          tone === "danger" && "text-danger-700",
        )}
      >
        {value}
      </dd>
      {sub && <p className="mt-0.5 text-2xs text-copy-muted">{sub}</p>}
    </div>
  );
}
