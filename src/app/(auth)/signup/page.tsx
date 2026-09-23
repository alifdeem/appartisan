import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AuthBackdrop } from "@/components/mobile/auth-backdrop";
import { AuthFooterScene } from "@/components/mobile/auth-scenery";
import { FloatingCard } from "@/components/mobile/floating-card";
import { Logo } from "@/components/brand/logo";
import { MobileScreen } from "@/components/mobile/mobile-screen";
import { PromiseList, TrustNote } from "@/components/mobile/trust-note";
import { PhoneAuthForm } from "../_components/phone-auth-form";
import { RolePicker } from "../_components/role-picker";
import { getCurrentProfile } from "@/lib/supabase/server";
import { homePathForRole } from "@/lib/auth/session";
import { photos } from "@/lib/images";

export const metadata: Metadata = { title: "Get started" };

/**
 * Sign-up entry, rebuilt against `designing-ui-ux/sign-up.png`.
 *
 * Two screens on one route, chosen by `?role=` — unchanged:
 *
 *   /signup                  the choice — which of the two products are you
 *                            here for, plus the argument for trusting us
 *   /signup?role=client      the form, with that role preselected
 *   /signup?role=provider
 *
 * One route rather than three because `/signup` is already in `PUBLIC_PATHS`
 * and already carries the "signed in? go home" rule in `src/proxy.ts`. Adding
 * a route would have meant editing routing logic to gain nothing.
 *
 * The reference's own "more ways to sign up" slot — Google and Apple — is where
 * ArtisanGH's two role paths go instead, because this product has neither.
 */

type Role = "client" | "provider";

function parseRole(value: string | string[] | undefined): Role | null {
  return value === "client" || value === "provider" ? value : null;
}

const CLAIMS = [
  "Ghana Card checked by a person, not a script",
  "Itemised price agreed before anyone travels",
  "Your money held until you sign the work off",
] as const;

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const profile = await getCurrentProfile();
  if (profile) redirect(homePathForRole(profile.role));

  const role = parseRole((await searchParams).role);

  if (role) return <SignupForm role={role} />;

  return (
    <MobileScreen ground="canvas">
      <AuthBackdrop variant="signup" />

      {/* `pb-8` even though the scene follows: when the photography is not on
          disk `AuthFooterScene` renders nothing at all, and without this the
          legal line would sit flush against the bottom of the viewport. */}
      <div className="relative flex flex-1 flex-col px-6 pt-3 pb-8">
        <BackLink href="/" />

        <Logo tagline size="md" className="mt-1" />

        <h1 className="mt-6 font-space text-[2rem] leading-[1.12] font-bold tracking-[-0.03em] text-navy-900">
          Create your account
        </h1>
        <p className="mt-3 max-w-[19rem] text-ui leading-relaxed text-copy-muted">
          Join thousands of Ghanaians who are finding and offering trusted services.
        </p>

        <div className="mt-8">
          {/* The picker owns the selection and the CTA that acts on it; the
              panel and the promises are static and pass straight through. */}
          <RolePicker>
            <TrustNote title="Your trust matters" className="mt-7">
              We verify all artisans and keep your information safe and secure.
            </TrustNote>

            <PromiseList label="Every job, every time" items={CLAIMS} className="mt-7" />
          </RolePicker>
        </div>

        <Legal className="mt-4" />
      </div>

      {/* ---- Background layer, foot of the screen ------------------------ */}
      {/* Outside the padded column so the skyline runs edge to edge. It is the
          last thing in the flow rather than positioned absolutely, so on a
          short screen it sits below the content instead of over it. */}
      <AuthFooterScene
        skyline={photos.authSkyline}
        figure={photos.authArtisanBack}
        className="relative mt-8"
      />
    </MobileScreen>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * The form step.
 *
 * Still the same `PhoneAuthForm` — it owns the two-step phone/code flow and the
 * exact `FormData` shape the actions expect, and none of that changed. What is
 * new is that it now sits in the login screen's floating card, so the two
 * screens that collect a phone number look like the same screen. They are the
 * same job.
 */
function SignupForm({ role }: { role: Role }) {
  return (
    <MobileScreen ground="canvas">
      <AuthBackdrop variant="signup" />

      <div className="relative flex flex-1 flex-col px-6 pt-3 pb-8">
        <BackLink href="/signup" />

        <Logo tagline size="md" className="mt-1" />

        <FloatingCard className="mt-8">
          <PhoneAuthForm
            mode="signup"
            initialRole={role}
            title={role === "client" ? "Book a service" : "Work as an artisan"}
            subtitle={
              role === "client"
                ? "Tell us how to reach you. Posting a job is free."
                : "Tell us how to reach you. Verification takes a day or two."
            }
          />
        </FloatingCard>

        {/* The legal line belongs beside the button that actually creates the
            account, which is this one — the choice screen carries its own copy
            because its CTA is also a commitment to proceed. */}
        <Legal className="mt-5" />
      </div>
    </MobileScreen>
  );
}

function BackLink({ href }: { href: "/" | "/signup" }) {
  return (
    <Link
      href={href}
      aria-label="Go back"
      className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-navy-900 transition-colors duration-[var(--duration-instant)] hover:bg-white/70 active:bg-white"
    >
      <ArrowLeft className="size-5" />
    </Link>
  );
}

function Legal({ className }: { className?: string }) {
  return (
    <p className={`text-center text-note leading-relaxed text-copy-muted ${className ?? ""}`}>
      By continuing you agree to our{" "}
      <Link href="/legal/terms" className="tap font-semibold text-azure-600 hover:underline">
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link href="/legal/privacy" className="tap font-semibold text-azure-600 hover:underline">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
