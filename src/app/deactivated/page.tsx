import type { Metadata } from "next";
import { ShieldOff } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Account deactivated" };

export default function DeactivatedPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-5 sm:px-8">
        <Logo />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-24 sm:px-8">
        <div className="w-full max-w-sm space-y-5 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-danger-50 text-danger-600">
            <ShieldOff className="size-6" />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-navy-900">
              This account is deactivated
            </h1>
            <p className="text-[0.9375rem] leading-relaxed text-copy-muted">
              You cannot book or accept work while your account is deactivated. If you think this is
              a mistake, contact support and we will look into it.
            </p>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary" block>
              Log out
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
