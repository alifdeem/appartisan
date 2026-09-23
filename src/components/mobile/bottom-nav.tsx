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

  /**
   * Hidden inside a draft.
   *
   * `/client/post` itself is the Browse tab and keeps the bar. Everything under
   * `/client/post/<jobId>/` is the three-step posting flow, which has its own
   * back control, its own step rail and its own pinned action — and in the
   * reference it is a focused flow with no tab bar at all.
   *
   * Two reasons beyond matching the reference. The bar and the flow's pinned
   * Continue would stack two full-width controls at the bottom of the screen,
   * and a thumb reaching for one finds the other. And "Browse" mid-flow walks
   * away from a half-written draft with no warning, which is a trap rather than
   * a shortcut — the flow's own back button is the way out.
   */
  if (/^\/client\/post\/[^/]+/.test(pathname)) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[26rem] justify-center px-4 pb-4 print:hidden"
    >
      {/* The one place `backdrop-blur` earns its cost: this bar sits over
          content that scrolls underneath it, which is exactly the case a solid
          fill cannot handle and a blur can. Everywhere else in this redesign
          the blur was declined for being expensive on low-end Android. */}
      <ul className="flex w-full items-center justify-around gap-1 rounded-full border border-white/80 bg-white/85 p-1.5 shadow-[var(--shadow-sheet)] backdrop-blur-xl">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full px-4",
                  "transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-spring",
                  "active:scale-[0.94]",
                  active
                    ? "bg-linear-to-b from-navy-800 to-navy-900 text-white shadow-[var(--shadow-glow-navy)]"
                    : "text-copy-muted hover:bg-azure-50 hover:text-navy-800",
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
