import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { AdminDrawer, AdminSidebar, type AdminNavCounts } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";
import { SimulatedBadge } from "@/components/ui/badge";
import { formatPhoneForDisplay } from "@/lib/phone";

/**
 * The console frame: a permanent rail at `lg`, a slim bar above the content.
 *
 * **Width.** `max-w-[1560px]`, against the phone-width column the client and
 * artisan apps use. A verification review puts a Ghana Card photograph beside
 * the typed number it has to match, and a dispute puts two accounts of the
 * same job side by side. Neither fits in 26rem, and both are the job.
 *
 * **The bar is thin on purpose.** 56px, and it carries only identity and the
 * way out. Every navigational decision lives in the rail, so a tall header
 * here would be chrome stacked on chrome.
 */
export function AdminShell({
  profile,
  simulated,
  counts,
  children,
}: {
  profile: { full_name: string; phone: string };
  simulated: boolean;
  counts: AdminNavCounts;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <AdminSidebar counts={counts} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hairline bg-white/85 px-4 backdrop-blur-md sm:px-6 print:hidden">
          <AdminDrawer counts={counts} />

          <Link href="/admin" className="rounded-[0.625rem] lg:hidden">
            <Logo />
          </Link>

          <div className="ml-auto flex items-center gap-3">
            {/* Grouped with the identity rather than stranded at the far left:
                at `lg` the rail owns the left edge, so a lone chip over there
                has nothing to belong to. */}
            {simulated && <SimulatedBadge className="hidden sm:inline-flex" />}

            <div className="hidden text-right leading-tight sm:block">
              <p className="text-note font-semibold text-navy-900">{profile.full_name}</p>
              <p className="tabular font-mono text-2xs text-copy-muted">
                {formatPhoneForDisplay(profile.phone)}
              </p>
            </div>

            <form action={signOutAction}>
              <button
                type="submit"
                className="grid size-9 place-items-center rounded-[0.625rem] text-copy-muted transition-colors duration-[var(--duration-instant)] hover:bg-azure-50 hover:text-navy-900"
              >
                <LogOutIcon />
                <span className="sr-only">Log out</span>
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 print:p-0">
          <div className="mx-auto w-full max-w-[1560px] print:max-w-none">{children}</div>
        </main>
      </div>
    </div>
  );
}

function LogOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-[1.125rem]" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m16 17 5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
