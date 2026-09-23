import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { AuthBackdrop } from "@/components/mobile/auth-backdrop";
import { AuthHero } from "@/components/mobile/auth-scenery";
import { FloatingCard } from "@/components/mobile/floating-card";
import { Logo } from "@/components/brand/logo";
import { MobileScreen } from "@/components/mobile/mobile-screen";
import { ServiceBadges } from "@/components/mobile/service-badges";
import { PhoneAuthForm } from "../_components/phone-auth-form";
import { SeededAccountsHint } from "../_components/seeded-accounts-hint";
import { devToolsEnabled } from "@/lib/env";
import { getCurrentProfile } from "@/lib/supabase/server";
import { homePathForRole } from "@/lib/auth/session";
import { photos } from "@/lib/images";

export const metadata: Metadata = { title: "Log in" };

/**
 * Log in — rebuilt against `designing-ui-ux/sign-in.png`.
 *
 * **The composition, top to bottom:** a decorative layer of coded blue shapes
 * with the artisan portrait masked into it; a UI layer of wordmark, promise and
 * service circles sitting on that; and the form in a white card that overlaps
 * the bottom of the photograph. Nothing in the image layer is text and nothing
 * in the UI layer is an image — which is what keeps the screen responsive, and
 * what lets the photography land later without a code change.
 *
 * **What the mockup draws that this screen does not have:**
 *
 *  • *A password field.* ArtisanGH is phone + OTP; there is no credential to
 *    type. The second step of the form puts the code where the password box
 *    was drawn. See the note in `phone-auth-form.tsx`.
 *  • *"Remember me" and "Forgot password?"* Both are password furniture. The
 *    session already persists across visits (`establishSession`), so a checkbox
 *    offering to do what already happens is a control that does nothing, and
 *    there is no password to recover.
 *
 * The room those two rows would have taken goes to the card's breathing space
 * rather than to filler, because the one honest instruction — that a code is
 * coming by SMS — is worth more than two dead controls.
 */
export default async function LoginPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect(homePathForRole(profile.role));

  return (
    <MobileScreen ground="canvas">
      {/* ---- Background layer ------------------------------------------- */}
      <AuthBackdrop variant="login" />
      {/* 12rem wide, not 17. At 17rem the plate reached 272px across a 400px
          column and ran straight through the headline — "for any service" was
          sitting under the artisan's wrench. The reference gives the portrait
          the right ~45% and keeps the text clear of it; these two widths are
          set against each other and should be changed together. */}
      <AuthHero src={photos.authPortrait} className="top-0 right-0 h-[24rem] w-[12.5rem]" />

      {/* ---- UI layer ---------------------------------------------------- */}
      <div className="relative flex flex-1 flex-col px-6 pt-3 pb-8">
        {/* `/login` is reachable from the landing page and from signup, so the
            way back is real. The mockup omits it; the signup screen it is
            paired with has one, and a back control that appears on one of two
            adjacent screens is worse than one that appears on both. */}
        <Link
          href="/"
          aria-label="Go back"
          className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-navy-900 transition-colors duration-[var(--duration-instant)] hover:bg-white/70 active:bg-white"
        >
          <ArrowLeft className="size-5" />
        </Link>

        <Logo tagline size="md" className="mt-1" />

        {/* The measure is set against the portrait's width above, not chosen
            for reading comfort: it is what keeps the text out from under the
            artisan at every viewport. A measure in `ch` would drift into the
            plate as the column narrows; a fixed one does not. */}
        <h1 className="mt-6 max-w-[12.5rem] font-space text-[1.75rem] leading-[1.14] font-bold tracking-[-0.03em] text-navy-900">
          Get trusted professionals for any service.
        </h1>

        <p className="mt-3.5 max-w-[12.5rem] text-note leading-relaxed text-copy-muted">
          From home repairs to event setup, find skilled artisans near you.
        </p>

        <div className="mt-6">
          <ServiceBadges />
        </div>

        {/* ---- The card ------------------------------------------------- */}
        {/* `mt-8`, not `mt-auto`. `mt-auto` ate every spare pixel on a tall
            viewport, which left a blank half-screen between the service circles
            and the card and read as a missing section. The card now follows the
            badges at a fixed distance and the page simply ends where it ends —
            which is what the mockup actually shows. */}
        <FloatingCard className="mt-8 pt-8">
          <PhoneAuthForm
            mode="login"
            /* `h2`: the hero headline above is this page's `h1`. */
            titleAs="h2"
            title="Welcome back"
            subtitle="Log in to your ArtisanGH account"
          />
        </FloatingCard>

        {devToolsEnabled && (
          <div className="mt-4">
            <SeededAccountsHint />
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-2 text-note text-copy-muted">
          <ShieldCheck className="size-4 text-azure-500" aria-hidden />
          Safe <Dot /> Secure <Dot /> Trusted
        </p>
      </div>
    </MobileScreen>
  );
}

/** The separator in the trust line. A real character, so it is announced as the
 *  pause it is rather than as a bullet list of one. */
function Dot() {
  return (
    <span aria-hidden className="text-hairline">
      •
    </span>
  );
}
