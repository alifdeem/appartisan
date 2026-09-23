import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { BottomNav } from "@/components/mobile/bottom-nav";
import { ProviderNav } from "@/components/provider/provider-nav";
import { DevPanel } from "@/components/dev/dev-panel";
import { devToolsEnabled, env, isSimulated } from "@/lib/env";
import { getAdminNavCounts } from "@/lib/admin/queries";
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
   * The client and the artisan apps have both been redesigned to the 2026
   * reference: a phone-width column on white, a floating tab bar, no top
   * chrome. They differ only in which bar they carry, because they answer
   * different questions — see `provider-nav.tsx`.
   *
   * The admin console keeps the header. It is dense, multi-column and used at a
   * desk; a 26rem column and a four-tab bar would be the wrong tool for a
   * verification queue.
   *
   * Branching on `profile.role` rather than the pathname because this layout
   * already has the profile and a Server Component cannot read the path anyway.
   */
  if (profile.role === "client" || profile.role === "provider") {
    /**
     * The two apps ground differently. The client app is pure white, per its
     * own reference. The artisan dashboard's reference is a pale blue wash —
     * "do not use flat white everywhere" — and its surfaces are lifted off that
     * ground by shadow rather than outlined, which only reads if the ground is
     * not the same colour as the cards.
     */
    const ground = profile.role === "client" ? "bg-white" : "bg-canvas";

    return (
      <div className={`flex min-h-dvh flex-col ${ground}`}>
        <main className="mx-auto w-full max-w-[26rem] flex-1 px-5 py-6 print:max-w-none print:p-0">
          {children}
        </main>

        {/* In the layout, not in each page: a tab bar that appears a frame late
            on some screens reads as the page jumping. */}
        {profile.role === "client" ? <BottomNav /> : <ProviderNav />}
        {devPanel}
      </div>
    );
  }

  /**
   * The admin console. Its own shell, because it is the one surface here that
   * is not phone-first — see `admin-shell.tsx`.
   *
   * The nav counts are read in the layout rather than the page so the rail
   * carries them on every admin screen, not only the overview.
   */
  const counts = await getAdminNavCounts();

  return (
    <>
      <AdminShell profile={profile} simulated={isSimulated} counts={counts}>
        {children}
      </AdminShell>
      {devPanel}
    </>
  );
}
