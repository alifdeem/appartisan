"use client";

import * as React from "react";
import { ChevronDown, FlaskConical } from "lucide-react";

import { SEED_ACCOUNTS } from "@/lib/dev/seed-accounts";
import { cn } from "@/lib/utils";

/**
 * Dev-only shortcut to the three seeded accounts.
 *
 * Collapsed by default so the login screen still photographs as the real thing
 * in a client demo, but one tap away when I am switching between roles twenty
 * times an hour. Rendered only when ENABLE_DEV_TOOLS is on and NODE_ENV is not
 * production, so it cannot ship.
 */
export function SeededAccountsHint() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded-card border border-dashed border-hairline bg-azure-50/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-medium text-copy-muted transition-colors hover:text-navy-900"
      >
        <FlaskConical className="size-4" />
        Test accounts
        <ChevronDown
          className={cn(
            "ml-auto size-4 transition-transform duration-[var(--duration-fast)] ease-out-strong",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul className="animate-fade-in space-y-1 border-t border-hairline px-2 pb-2 pt-2">
          {SEED_ACCOUNTS.map((account) => (
            <li key={account.phone}>
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById("phone") as HTMLInputElement | null;
                  if (!input) return;
                  // Drive React's onChange, not just the DOM value.
                  const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    "value",
                  )?.set;
                  setter?.call(input, account.localPhone);
                  input.dispatchEvent(new Event("input", { bubbles: true }));
                  input.focus();
                }}
                className="flex w-full items-baseline gap-2 rounded-field px-2 py-2 text-left transition-colors hover:bg-white"
              >
                <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-copy-muted">
                  {account.label}
                </span>
                <span className="tabular text-sm text-navy-900">{account.localPhone}</span>
                <span className="ml-auto truncate text-xs text-copy-muted">{account.fullName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-hairline px-4 py-2.5 text-xs text-copy-muted">
        While SMS is mocked the code is fixed, and shown to you on the next screen.
      </p>
    </div>
  );
}
