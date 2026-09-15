import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PhoneAuthForm } from "../_components/phone-auth-form";
import { getCurrentProfile } from "@/lib/supabase/server";
import { homePathForRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect(homePathForRole(profile.role));

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold text-ink-900">Create your account</h1>
        <p className="text-[0.9375rem] text-ink-600">
          Takes about a minute. No card needed to sign up.
        </p>
      </div>

      <PhoneAuthForm mode="signup" />
    </div>
  );
}
