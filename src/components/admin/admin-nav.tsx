"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  LayoutDashboard,
  Receipt,
  Map,
  Radar,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
  X,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * The admin console's navigation.
 *
 * **Why this exists at all.** The old dashboard carried six identical
 * full-width link rows down the page: verification, matching, disputes,
 * trades, settings, zones. They were not a design; they were navigation with
 * nowhere to live, and they pushed every actual figure below the fold. Give
 * the console a real nav and the entire top half of that screen is freed for
 * the thing an operator opens it to see.
 *
 * **Permanent at `lg`, a drawer below it.** This is the one surface in
 * ArtisanGH that is not phone-first: verification means reading a Ghana Card
 * photograph against a typed number, and disputes means reading two accounts
 * of the same job side by side. Both are desk work. The drawer is for the
 * operator checking the queue from a phone on a Sunday, not the main case.
 *
 * Counts sit on the items that can have a queue. A number here is the whole
 * reason to look at the nav rather than the page you are already on.
 */

export interface AdminNavCounts {
  verification: number;
  disputes: number;
  stalled: number;
}

const SECTIONS: ReadonlyArray<{
  heading: string;
  items: ReadonlyArray<{
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
    badge?: keyof AdminNavCounts;
  }>;
}> = [
  {
    heading: "Operations",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
      {
        href: "/admin/verification",
        label: "Verification",
        icon: ShieldCheck,
        badge: "verification",
      },
      {
        href: "/admin/disputes",
        label: "Disputes",
        icon: ShieldAlert,
        badge: "disputes",
      },
      {
        href: "/admin/matching",
        label: "Matching",
        icon: Radar,
        badge: "stalled",
      },
      // The two ledgers. They carry no badge because neither is a queue -
      // nobody is waiting on them, they are where you go to look something up.
      { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
      { href: "/admin/transactions", label: "Transactions", icon: Receipt },
    ],
  },
  {
    heading: "Configuration",
    items: [
      { href: "/admin/categories", label: "Trades", icon: Wrench },
      { href: "/admin/zones", label: "Transport bands", icon: Map },
      {
        href: "/admin/settings",
        label: "Platform settings",
        icon: SlidersHorizontal,
      },
    ],
  },
];

function NavList({
  counts,
  onNavigate,
}: {
  counts: AdminNavCounts;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-7">
      {SECTIONS.map((section) => (
        <div key={section.heading}>
          <h2 className="px-3 text-2xs font-semibold tracking-[0.08em] text-copy-muted uppercase">
            {section.heading}
          </h2>

          <ul className="mt-2 space-y-0.5">
            {section.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              const badge = item.badge ? counts[item.badge] : 0;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex min-h-11 items-center gap-3 rounded-[0.75rem] px-3 text-ui font-medium",
                      "transition-colors duration-[var(--duration-fast)] ease-out-strong",
                      active
                        ? "bg-navy-800 text-white"
                        : "text-copy hover:bg-azure-50 hover:text-navy-900",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[1.125rem] shrink-0",
                        active
                          ? "text-white"
                          : "text-copy-muted group-hover:text-navy-800",
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>

                    {badge > 0 && (
                      <span
                        className={cn(
                          "tabular grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 font-mono text-2xs font-semibold",
                          active
                            ? "bg-white/20 text-white"
                            : "bg-warning-50 text-warning-700",
                        )}
                      >
                        {badge}
                        {/* The number alone is ambiguous out of context, and a
                            screen reader lands on it with no idea what it
                            counts. */}
                        <span className="sr-only"> waiting</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AdminSidebar({ counts }: { counts: AdminNavCounts }) {
  return (
    <nav
      aria-label="Console"
      className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-white lg:flex print:hidden"
    >
      {/* The mark lives here, not in the bar. At `lg` the bar's left side is
          empty, and a logo floating in it reads as a stray element; at the top
          of the rail it is where every console in the world puts it. */}
      <div className="flex h-14 shrink-0 items-center border-b border-hairline px-5">
        <Link href="/admin" className="rounded-[0.5rem]">
          <Logo />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-6">
        <NavList counts={counts} />
      </div>
    </nav>
  );
}

/**
 * The same list as a drawer, under `lg`.
 *
 * Closes on Escape and on navigating, because a drawer that survives a route
 * change covers the page you just asked for. Closing happens on the link's own
 * click rather than by watching the pathname: setting state from an effect
 * that fires on every navigation is a render-loop waiting to happen, and the
 * click is the actual event we care about.
 */
export function AdminDrawer({ counts }: { counts: AdminNavCounts }) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const waiting = counts.verification + counts.disputes + counts.stalled;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-[0.75rem] text-copy-muted transition-colors duration-[var(--duration-instant)] hover:bg-azure-50 hover:text-navy-900"
      >
        <span className="sr-only">Open console menu</span>
        <span aria-hidden className="space-y-1">
          <span className="block h-0.5 w-5 rounded-full bg-current" />
          <span className="block h-0.5 w-5 rounded-full bg-current" />
          <span className="block h-0.5 w-3.5 rounded-full bg-current" />
        </span>
        {waiting > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-warning-500 ring-2 ring-white" />
        )}
      </button>

      {/**
       * Portalled to `document.body`, and it has to be.
       *
       * This drawer lives inside a header that carries `backdrop-blur`, and a
       * `backdrop-filter` on an ancestor establishes a containing block for
       * every `position: fixed` descendant. So `fixed inset-0` resolved
       * against the 56px header rather than the viewport: the scrim covered
       * only the header strip, the panel was clipped to it, and the
       * navigation list was rendered but invisible and unclickable. Caught in
       * a real browser; it is invisible in the markup.
       */}
      {/* No `mounted` guard is needed: `open` starts false, so this branch
          runs neither on the server nor on the first client render, and by the
          time it does run `document` exists. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]"
            />

            <div className="absolute inset-y-0 left-0 flex w-[17rem] flex-col bg-white px-3 py-4 shadow-[var(--shadow-sheet)]">
              <div className="mb-5 flex items-center justify-between px-2">
                <span className="font-space text-lede font-bold text-navy-900">
                  Console
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid size-9 place-items-center rounded-[0.625rem] text-copy-muted hover:bg-azure-50 hover:text-navy-900"
                >
                  <X className="size-4" />
                  <span className="sr-only">Close menu</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <NavList counts={counts} onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
