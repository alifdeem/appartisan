import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { BottomNav } from "@/components/mobile/bottom-nav";
import { DevPanel } from "@/components/dev/dev-panel";
import { devToolsEnabled, env, isSimulated } from "@/lib/env";
import { getCurrentProfile } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfile();

  // The proxy already gates this, but a Server Component must never assume the
  // proxy ran — route handlers, prefetches and direct RSC requests can all
  // arrive by other paths.
  if (!profile) redirect("/login");

  const devPanel = devToolsEnabled ? (
    <DevPanel
      currentRole={profile.role}
      providers={{
        payment: env.PAYMENT_PROVIDER,
        sms: env.SMS_PROVIDER,
        map: env.MAP_PROVIDER,
      }}
    />
  ) : null;

  /**
   * Two shells, chosen by role.
   *
   * The client app has been redesigned to the new reference: a phone-width
   * column on white, with a floating tab bar and no top chrome at all. The
   * admin console and the provider screens have not — they are dense,
   * multi-column, and still want the header with its role badge and the wide
   * container.
   *
   * Branching on `profile.role` rather than the pathname because this layout
   * already has the profile and a Server Component cannot read the path
   * anyway. When the other two roles are redesigned this whole fork
   * disappears and the mobile shell becomes the only one — which is what the
   * redesign plan means by "the app shell every signed-in screen inherits".
   */
  if (profile.role === "client") {
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <main className="mx-auto w-full max-w-[26rem] flex-1 px-5 py-6 print:max-w-none print:p-0">
          {children}
        </main>

        {/* In the layout, not in each page: a tab bar that appears a frame late
            on some screens reads as the page jumping. */}
        <BottomNav />
        {devPanel}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* The header, the dev panel and the page padding are app chrome. On
          paper they are a wasted top margin and a nav bar nobody can click —
          see the print block in globals.css. */}
      <div className="print:hidden">
        <AppHeader profile={profile} simulated={isSimulated} />
      </div>

      <main className="flex-1 px-5 py-6 sm:px-8 sm:py-10 print:p-0">
        <div className="mx-auto w-full max-w-5xl print:max-w-none">{children}</div>
      </main>

      {devToolsEnabled && (
        <DevPanel
          currentRole={profile.role}
          providers={{
            payment: env.PAYMENT_PROVIDER,
            sms: env.SMS_PROVIDER,
            map: env.MAP_PROVIDER,
          }}
        />
      )}
    </div>
  );
}
