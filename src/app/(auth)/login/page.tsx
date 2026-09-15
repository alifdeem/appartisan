import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PhoneAuthForm } from "../_components/phone-auth-form";
import { SeededAccountsHint } from "../_components/seeded-accounts-hint";
import { devToolsEnabled } from "@/lib/env";
import { getCurrentProfile } from "@/lib/supabase/server";
import { homePathForRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect(homePathForRole(profile.role));

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold text-ink-900">Welcome back</h1>
        <p className="text-[0.9375rem] text-ink-600">
          Log in with the mobile number on your account.
        </p>
      </div>

      <PhoneAuthForm mode="login" />

      {devToolsEnabled && <SeededAccountsHint />}
    </div>
  );
}
