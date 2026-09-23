import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CategoryIcon } from "@/components/marketplace/category-icon";
import { cn } from "@/lib/utils";

/**
 * The furniture both job screens share.
 *
 * There are two job screens — the client's and the artisan's — and they are not
 * the same screen with a flag: they answer different questions, in different
 * orders, for people in different situations. What they genuinely share is the
 * chrome: a way back, a title block, and a section rhythm. That is what lives
 * here.
 *
 * Keeping it to three small pieces is deliberate. The last version of these
 * screens shared `Card`/`CardContent`, which sounds like the same idea and is
 * not — `Card` decides padding, radius, border and fill for its contents, so
 * every panel on both screens looked identical whether it was a payment
 * demanding attention or an audit log nobody reads. Depth is how a screen says
 * what matters; one card component spent it evenly on everything.
 */

/**
 * Back, then the job's identity.
 *
 * The title is the trade, because that is how somebody refers to a job out
 * loud — "the plumbing one", never "AGH-260917-DF015". The reference is
 * underneath in mono, where it can be read out to support without competing.
 *
 * **No status badge here.** It was the obvious thing to put on the right of
 * this row and it is redundant: the hero directly below says the state in
 * forty-point type with a live dot next to it. At 360px the badge also had
 * nowhere to go — it wrapped onto a third line under the reference, so the
 * first thing on the screen was three stacked lines of metadata before any
 * content. The state is said once, loudly, in the place built for it.
 */
export function JobDetailHeader({
  back,
  backLabel,
  icon,
  title,
  meta,
}: {
  back: string;
  /** Read by screen readers on the back control. */
  backLabel: string;
  /** A category icon name — `job.category.icon`. */
  icon: string;
  title: string;
  /** Reference, and when. Mono digits belong here, not in the title. */
  meta: React.ReactNode;
}) {
  return (
    <header className="space-y-4">
      <Link
        href={back}
        aria-label={backLabel}
        className={cn(
          "-ml-2 grid size-11 place-items-center rounded-full text-navy-900",
          "transition-colors duration-[var(--duration-instant)] hover:bg-azure-50 active:bg-azure-100",
        )}
      >
        <ArrowLeft className="size-5" aria-hidden />
      </Link>

      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-[1rem]",
            "bg-azure-50 text-navy-800 [&_svg]:size-6",
          )}
        >
          <CategoryIcon name={icon} />
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="font-space text-title-sm leading-tight font-bold text-navy-900">
            {title}
          </h1>
          <p className="tabular mt-1 font-mono text-2xs text-copy-muted">{meta}</p>
        </div>
      </div>
    </header>
  );
}

/**
 * A titled block.
 *
 * Same heading rhythm as the dashboards, and one component is what keeps the
 * gap under the title from drifting by two pixels between sections — which on
 * a screen this long is the difference between designed and assembled.
 *
 * `h2` throughout: both screens have exactly one `h1` (the trade, above) and
 * every section sits directly under it. A card inside a section that needs its
 * own title uses `h3`, which is why panels take a heading level rather than
 * hard-coding one.
 */
export function DetailSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  /** Optional right-aligned link on the heading row. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-space text-lede font-bold text-navy-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * The plain white panel the quieter sections sit in.
 *
 * Hairline and no shadow, on purpose. The screen already has two loud objects —
 * the status hero and whatever the reader has to act on — and a third surface
 * competing with them is how a long screen ends up with no hierarchy at all.
 * Anything that needs to shout opts out and draws its own shell.
 */
export function DetailPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[1.25rem] border border-hairline bg-white p-4", className)}>
      {children}
    </div>
  );
}
