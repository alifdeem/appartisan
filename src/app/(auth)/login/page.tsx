import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MobileScreen } from "@/components/mobile/mobile-screen";
import { ScreenHeader } from "@/components/mobile/screen-header";
import { PhoneAuthForm } from "../_components/phone-auth-form";
import { SeededAccountsHint } from "../_components/seeded-accounts-hint";
import { devToolsEnabled } from "@/lib/env";
import { getCurrentProfile } from "@/lib/supabase/server";
import { homePathForRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Log in" };

/**
 * The `(auth)` layout no longer supplies chrome, so the screen owns it — see
 * the note in `../layout.tsx`. The form itself is untouched pending its restyle
 * later in Phase 1; this is the shell it will be restyled inside.
 */
export default async function LoginPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect(homePathForRole(profile.role));

  return (
    <MobileScreen>
      <ScreenHeader back="/" title="Log in" />

      <div className="px-6 pt-2 pb-10">
        <PhoneAuthForm
          mode="login"
          title="Welcome back"
          subtitle="Log in with the mobile number on your account."
        />

        {devToolsEnabled && (
          <div className="mt-6">
            <SeededAccountsHint />
          </div>
        )}
      </div>
    </MobileScreen>
  );
}
