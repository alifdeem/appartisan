import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { DevPanel } from "@/components/dev/dev-panel";
import { devToolsEnabled, env, isSimulated } from "@/lib/env";
import { getCurrentProfile } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfile();

  // The proxy already gates this, but a Server Component must never assume the
  // proxy ran — route handlers, prefetches and direct RSC requests can all
  // arrive by other paths.
  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader profile={profile} simulated={isSimulated} />

      <main className="flex-1 px-5 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
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
