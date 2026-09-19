import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Hammer, House } from "lucide-react";

import { FieldLabel } from "@/components/mobile/field-label";
import { MobileScreen } from "@/components/mobile/mobile-screen";
import { ScreenHeader } from "@/components/mobile/screen-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { PhoneAuthForm } from "../_components/phone-auth-form";
import { getCurrentProfile } from "@/lib/supabase/server";
import { homePathForRole } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Get started" };

/**
 * Sign-up entry.
 *
 * Two screens on one route, chosen by `?role=`:
 *
 *   /signup                  the option screen — which of the two products are
 *                            you here for
 *   /signup?role=client      the form, with that role preselected
 *   /signup?role=provider
 *
 * One route rather than three because `/signup` is already in `PUBLIC_PATHS`
 * and already carries the "signed in? go home" rule in `src/proxy.ts`. Adding
 * `/welcome` would have meant editing routing logic to gain nothing.
 *
 * The role choice moving *out* of the form and onto its own screen is the point
 * of the reference's onboarding: ask one question per screen. It used that slot
 * for Google and Apple sign-in, which this product does not have — so the two
 * real paths through ArtisanGH take it instead.
 */

type Role = "client" | "provider";

function parseRole(value: string | string[] | undefined): Role | null {
  return value === "client" || value === "provider" ? value : null;
}

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const profile = await getCurrentProfile();
  if (profile) redirect(homePathForRole(profile.role));

  const role = parseRole((await searchParams).role);

  if (role) return <SignupForm role={role} />;

  return (
    <MobileScreen footer={<Legal />}>
      <ScreenHeader back="/" />

      <div className="px-6 pt-2">
        {/* `title-sm` rather than `title`. The reference sets this headline at
            ~23px in a geometric sans; Bricolage is a display face and carries
            noticeably more weight at the same size, so matching their pixel
            size would have overshot their tone. */}
        <h1 className="text-title-sm font-semibold text-balance text-ink-900">
          Sign up or log in to book verified artisans near you.
        </h1>

        <FieldLabel className="mt-8">I want to</FieldLabel>

        <div className="mt-3 space-y-3">
          <Link
            href="/signup?role=client"
            className={cn(buttonVariants({ size: "lg", shape: "pill", block: true }))}
          >
            <House />
            Book a service
          </Link>

          <Link
            href="/signup?role=provider"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg", shape: "pill", block: true }),
            )}
          >
            <Hammer />
            Work as an artisan
          </Link>
        </div>

        <p className="mt-5 text-ui text-ink-600">
          Already have an account?{" "}
          <Link href="/login" className="tap font-medium text-brand-700 hover:underline">
            Log in
          </Link>
        </p>

        {/* The reference's second labelled group is Google and Apple sign-in,
            which this product does not have. Rather than collapse to one group
            and leave half the screen empty, the slot carries the argument the
            screen is actually making — the three things that are true of every
            job on this platform. This is the copy the old desktop auth layout
            showed in its photo panel; the panel is gone, the argument is not. */}
        <FieldLabel className="mt-9">Every job, every time</FieldLabel>

        <ul className="mt-3 space-y-2.5">
          {CLAIMS.map((claim) => (
            <li key={claim} className="flex items-start gap-2.5 text-ui text-ink-600">
              <Check className="mt-1 size-4 shrink-0 text-brand-600" strokeWidth={2.75} aria-hidden />
              {claim}
            </li>
          ))}
        </ul>
      </div>
    </MobileScreen>
  );
}

const CLAIMS = [
  "Ghana Card checked by a person, not a script",
  "Itemised price agreed before anyone travels",
  "Your money held until you sign the work off",
];

/* ------------------------------------------------------------------------- */

/**
 * The form step. Still the existing `PhoneAuthForm` — it owns the two-step
 * phone/code flow and the exact `FormData` shape `requestCodeAction` expects,
 * and none of that changes here. Only the chrome around it is new; the form's
 * own restyle is the next item in Phase 1.
 */
function SignupForm({ role }: { role: Role }) {
  return (
    <MobileScreen>
      <ScreenHeader back="/signup" title="Sign up" />

      <div className="px-6 pt-2 pb-10">
        <PhoneAuthForm
          mode="signup"
          initialRole={role}
          title="Create your account"
          subtitle={
            role === "client"
              ? "Tell us how to reach you. Posting a job is free."
              : "Tell us how to reach you. Verification takes a day or two."
          }
        />
      </div>
    </MobileScreen>
  );
}

function Legal() {
  return (
    <p className="text-note text-ink-500">
      By continuing you agree to our{" "}
      <Link href="/legal/terms" className="tap font-medium text-brand-700 hover:underline">
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link href="/legal/privacy" className="tap font-medium text-brand-700 hover:underline">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
