import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, LogOut, Phone, ShieldCheck, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/mobile/field-label";
import { formatPhoneForDisplay } from "@/lib/phone";
import { getCurrentProfile } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Account" };

/**
 * The account tab.
 *
 * Deliberately small. The reference's account screen carries an earnings
 * overview and a booking history; the history already has its own tab here, and
 * a client has no earnings. What is left is who you are, how we reach you, the
 * documents you agreed to, and the way out — which is the honest content of
 * this screen for a client today.
 *
 * It exists now because `BottomNav` has four tabs and a tab that opens nothing
 * is worse than three tabs. The fuller version (`@7-account`) lands with the
 * rest of that screen's work.
 */
export default async function AccountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
      <div className="space-y-7 pb-28">
      <header className="space-y-1">
        <h1 className="text-title font-semibold text-ink-900">Account</h1>
        <p className="text-ui text-ink-600">Your details and how we reach you.</p>
      </header>

      <section className="space-y-4 rounded-card border border-ink-200 bg-white p-5">
        <div className="flex items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
            <User className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lede font-semibold text-ink-900">{profile.full_name}</p>
            <p className="tabular truncate font-mono text-sm text-ink-500">
              {formatPhoneForDisplay(profile.phone)}
            </p>
            </div>
          </div>

          <div className="space-y-1 border-t border-ink-100 pt-4">
            <FieldLabel>How you sign in</FieldLabel>
            <p className="flex items-start gap-2 text-note leading-relaxed text-ink-600">
              <Phone className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-hidden />
              Your phone number is your account. There is no password to forget — we text you a
              code each time.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <FieldLabel>The small print</FieldLabel>

          <Link
            href="/legal/terms"
            className="flex min-h-12 items-center gap-3 rounded-card border border-ink-200 bg-white px-4 text-ui text-ink-800 transition-colors hover:border-ink-300"
          >
            <FileText className="size-4 shrink-0 text-ink-400" aria-hidden />
            Terms of service
          </Link>

          <Link
            href="/legal/privacy"
            className="flex min-h-12 items-center gap-3 rounded-card border border-ink-200 bg-white px-4 text-ui text-ink-800 transition-colors hover:border-ink-300"
          >
            <ShieldCheck className="size-4 shrink-0 text-ink-400" aria-hidden />
            Privacy notice
          </Link>
        </section>

        <form action={signOutAction}>
          <Button type="submit" variant="outline" shape="pill" size="lg" block>
            <LogOut />
            Log out
          </Button>
        </form>
    </div>
  );
}
