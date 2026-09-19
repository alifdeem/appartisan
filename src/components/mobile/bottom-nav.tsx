"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Receipt, User } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The bottom tab bar.
 *
 * The reference's signature navigation: a floating white bar with the active
 * tab as a filled pill carrying its label, and the inactive tabs as bare icons.
 * Only the active tab is named, which is what lets four tabs fit at 360px
 * without any of them truncating.
 *
 * **Four tabs, and what they are not.** The reference's third slot is chat.
 * ArtisanGH has no in-app messaging — PLAN.md §14 puts it out of v1 and points
 * at masked calling or WhatsApp instead — so that slot carries Jobs, which is
 * the thing a returning client actually opens the app for. Inventing a chat tab
 * that opens an empty screen would be worse than having three tabs.
 *
 * `position: fixed`, not `sticky`: the rules ask for RN-translatable CSS, and
 * a fixed bottom bar maps onto a tab navigator directly. The page owns its own
 * bottom padding so the bar never covers the last row of content.
 */

const TABS = [
  { href: "/client", label: "Home", icon: Home, exact: true },
  { href: "/client/post", label: "Browse", icon: LayoutGrid, exact: false },
  { href: "/client/jobs", label: "Jobs", icon: Receipt, exact: false },
  { href: "/client/account", label: "Account", icon: User, exact: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[26rem] justify-center px-4 pb-4 print:hidden"
    >
      <ul className="flex w-full items-center justify-around gap-1 rounded-full border border-ink-200/70 bg-white/95 p-1.5 shadow-lg backdrop-blur">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full px-4 transition-colors",
                  active
                    ? "bg-brand-700 text-white"
                    : "text-ink-500 hover:bg-ink-100 hover:text-ink-800",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {/* Inactive tabs keep their name for screen readers but not for
                    the eye — four visible labels do not fit at 360px. */}
                <span className={cn("truncate text-sm font-medium", !active && "sr-only")}>
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
