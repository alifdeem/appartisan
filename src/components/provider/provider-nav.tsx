"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, ClipboardList, Home, User } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The artisan's tab bar.
 *
 * **Four tabs, and why they are these four.** The client's bar is built around
 * choosing — Home, Browse, Jobs, Account. An artisan chooses nothing: work is
 * offered to them. Their four questions are *am I on*, *what have I got on*,
 * *what have I been paid*, and *who am I on this platform*. So: Today, Jobs,
 * Earnings, Account.
 *
 * **Earnings is a tab, not a section of the dashboard.** This is the screen
 * that decides whether someone keeps using the app. Burying money one level
 * down in a product whose entire pitch to artisans is "you get paid properly"
 * would be burying the pitch.
 *
 * Same shape as the client bar — a floating pill, active tab filled and
 * labelled, inactive ones icon-only with `sr-only` labels, which is what lets
 * four fit at 360px. Deliberately identical: an artisan who also books work as
 * a client should not have to learn two navigations.
 *
 * Hidden inside the application flow. Someone who has not been approved yet has
 * no jobs, no earnings and nothing to be available for, so three of the four
 * tabs would open empty screens; `/provider/apply` is a focused, linear flow
 * with its own step rail and its own way out.
 */

const TABS = [
  { href: "/provider", label: "Today", icon: Home, exact: true },
  { href: "/provider/jobs", label: "Jobs", icon: ClipboardList, exact: false },
  { href: "/provider/earnings", label: "Earnings", icon: Banknote, exact: false },
  { href: "/provider/account", label: "Account", icon: User, exact: false },
] as const;

export function ProviderNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/provider/apply")) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[26rem] justify-center px-4 pb-4 print:hidden"
    >
      {/* Frosted and floating, per the reference: no border, a deep soft
          shadow, and a heavy blur — this bar sits over content that scrolls
          beneath it, which is the one case a solid fill cannot handle. */}
      <ul className="flex w-full items-center justify-around gap-1 rounded-[2rem] bg-white/80 p-2 shadow-[var(--shadow-sheet)] backdrop-blur-xl">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // Stacked icon over label, as drawn — and every tab keeps its
                  // label, unlike the client bar where four visible labels do
                  // not fit. Four stacked tabs at 360px have room for all four.
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.5rem] px-3 py-1.5",
                  "transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-spring",
                  "active:scale-[0.94]",
                  active
                    ? "bg-linear-to-b from-navy-800 to-navy-900 text-white shadow-[var(--shadow-glow-navy)]"
                    : "text-copy-muted hover:text-navy-800",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="truncate text-2xs font-semibold">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
