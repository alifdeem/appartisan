import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MobileScreen } from "@/components/mobile/mobile-screen";
import { SuccessMark } from "@/components/mobile/success-mark";
import { getCurrentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "You're in" };

/**
 * The success screen (`@5-success` in the reference).
 *
 * **Not yet in the signup flow, deliberately.** `verifyCodeAction` ends with
 * `redirect(homePathForRole(profileRole))`, and `newredesign-reference-rules.md`
 * §1 puts `actions.ts` off-limits to this redesign. Wiring it is one line —
 * redirect to `/welcome` instead of the role home — but that is a change to
 * auth behaviour, not to presentation, so it is a decision rather than a
 * refactor. The screen is built and reachable at `/welcome` meanwhile.
 *
 * What it says depends on who just signed up, and that is the argument for
 * having it at all:
 *
 *   • A **client** has nothing left to do — name and number were the whole
 *     signup — so this is a confirmation and a doorway.
 *   • An **artisan** has the entire verification application still ahead of
 *     them: Ghana Card, a photograph, trades, payout details, and a call. For
 *     them an interstitial that names the next step is worth the tap.
 *
 * The reference's "Skip" is not here. It skips profile completion to browse;
 * ArtisanGH has no profile-completion step for a client, and an artisan who
 * skips verification cannot receive work, so the control would either do
 * nothing or quietly strand somebody.
 */
export default async function WelcomePage() {
  const profile = await getCurrentProfile();

  // A Server Component never assumes the proxy ran.
  if (!profile) redirect("/login");

  const isProvider = profile.role === "provider";
  const firstName = profile.full_name.split(" ")[0];

  const next = isProvider ? "/provider/apply" : "/client/post";

  return (
    <MobileScreen
      footer={
        <div className="px-6 pb-8">
          <Link href={next} className="block">
            <Button size="lg" shape="pill" block>
              {isProvider ? "Start verification" : "Book your first service"}
              <ArrowUpRight />
            </Button>
          </Link>
        </div>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <SuccessMark className="size-32 text-success-600" />

        <h1 className="mt-6 text-title font-semibold text-navy-900">
          Success! You&rsquo;re in{firstName ? `, ${firstName}` : ""}.
        </h1>

        <p className="mt-2 max-w-xs text-ui leading-relaxed text-copy-muted">
          {isProvider
            ? "One more step. We verify every artisan against their Ghana Card before any client can book them."
            : "Tell us what needs doing and we'll find a verified artisan near you. You approve the price before anyone travels."}
        </p>
      </div>
    </MobileScreen>
  );
}
