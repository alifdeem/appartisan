"use client";

import * as React from "react";
import { CreditCard, Map, MessageSquare, Wrench, X } from "lucide-react";

import { switchRoleAction } from "@/app/dev-actions";
import { SEED_ACCOUNTS } from "@/lib/dev/seed-accounts";
import type { UserRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * The dev panel.
 *
 * A floating pill that opens into a role switcher plus a readout of which
 * adapter each integration is currently running. That readout matters more than
 * it looks: the single most expensive mistake available in this codebase is
 * believing a payment was real when it was mocked, or the reverse.
 *
 * Never rendered in production — the parent layout gates on `devToolsEnabled`.
 */
export function DevPanel({
  currentRole,
  providers,
}: {
  currentRole: UserRole;
  providers: { payment: string; sms: string; map: string };
}) {
  const [open, setOpen] = React.useState(false);

  // Cmd/Ctrl + Shift + D. Quicker than aiming at the pill.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    // `bottom-24` clears the client shell's floating tab bar, which is also
    // fixed to the bottom of the viewport. At `bottom-4` the two overlapped and
    // the dev pill sat on top of the Home tab.
    <div className="pointer-events-none fixed bottom-24 left-4 z-50 print:hidden">
      {open ? (
        <div className="animate-fade-up pointer-events-auto w-[19rem] rounded-card border border-copy bg-navy-950 p-3 text-azure-50 shadow-xl">
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="size-4 text-warning-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-hairline">
              Dev tools
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto grid size-7 place-items-center rounded-field text-copy-muted transition-colors hover:bg-navy-900 hover:text-azure-50"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>

          <p className="mb-2 text-[0.6875rem] uppercase tracking-wider text-copy-muted">
            Sign in as
          </p>
          <div className="mb-4 grid gap-1.5">
            {SEED_ACCOUNTS.map((account) => (
              <form key={account.role} action={switchRoleAction}>
                <input type="hidden" name="role" value={account.role} />
                <button
                  type="submit"
                  disabled={account.role === currentRole}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-field px-2.5 py-2 text-left",
                    "transition-colors duration-[var(--duration-instant)]",
                    account.role === currentRole
                      ? "cursor-default bg-navy-900/60 text-azure-50 ring-1 ring-navy-800"
                      : "text-hairline hover:bg-navy-900",
                  )}
                >
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{account.label}</span>
                    <span className="block text-[0.6875rem] text-copy-muted">{account.fullName}</span>
                  </span>
                  {account.role === currentRole && (
                    <span className="text-[0.6875rem] font-medium text-azure-300">current</span>
                  )}
                </button>
              </form>
            ))}
          </div>

          <p className="mb-2 text-[0.6875rem] uppercase tracking-wider text-copy-muted">
            Integrations
          </p>
          <dl className="grid gap-1">
            <ProviderRow icon={<CreditCard />} label="Payments" value={providers.payment} />
            <ProviderRow icon={<MessageSquare />} label="SMS" value={providers.sms} />
            <ProviderRow icon={<Map />} label="Maps" value={providers.map} live={providers.map === "osm"} />
          </dl>

          <p className="mt-3 border-t border-navy-900 pt-2.5 text-[0.6875rem] leading-relaxed text-copy-muted">
            Dev only — never rendered in production.{" "}
            <kbd className="rounded bg-navy-900 px-1 py-0.5 font-mono">⌘⇧D</kbd> toggles.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "pointer-events-auto flex min-h-9 items-center gap-2 rounded-full bg-navy-950 px-3.5 text-xs font-medium text-azure-50 shadow-lg",
            "transition-transform duration-[var(--duration-instant)] ease-out-strong hover:scale-[1.03] active:scale-[0.97]",
          )}
        >
          <Wrench className="size-3.5 text-warning-500" />
          Dev
        </button>
      )}
    </div>
  );
}

function ProviderRow({
  icon,
  label,
  value,
  live,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  live?: boolean;
}) {
  const isLive = live ?? value === "live";
  return (
    <div className="flex items-center gap-2.5 rounded-field px-2.5 py-1.5 text-sm">
      <span className="text-copy-muted [&_svg]:size-4">{icon}</span>
      <dt className="text-hairline">{label}</dt>
      <dd
        className={cn(
          "ml-auto rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide",
          isLive ? "bg-success-500/15 text-success-500" : "bg-warning-500/15 text-warning-500",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
