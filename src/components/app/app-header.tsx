import Link from "next/link";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { Badge, SimulatedBadge } from "@/components/ui/badge";
import { formatPhoneForDisplay } from "@/lib/phone";
import type { UserRole } from "@/lib/supabase/types";

const ROLE_LABEL: Record<UserRole, string> = {
  client: "Client",
  provider: "Artisan",
  admin: "Admin",
};

const ROLE_HOME: Record<UserRole, string> = {
  client: "/client",
  provider: "/provider",
  admin: "/admin",
};

export function AppHeader({
  profile,
  simulated,
}: {
  profile: { role: UserRole; full_name: string; phone: string };
  simulated: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-ink-0/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-5 sm:px-8">
        <Link href={ROLE_HOME[profile.role]} className="rounded-field">
          <Logo />
        </Link>

        <Badge tone={profile.role === "admin" ? "brand" : "neutral"}>
          {ROLE_LABEL[profile.role]}
        </Badge>

        {simulated && <SimulatedBadge className="hidden sm:inline-flex" />}

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium text-ink-900">{profile.full_name}</p>
            <p className="tabular text-xs text-ink-500">{formatPhoneForDisplay(profile.phone)}</p>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              title="Log out"
              className="grid size-10 place-items-center rounded-field text-ink-500 transition-colors duration-[var(--duration-instant)] hover:bg-ink-100 hover:text-ink-900"
            >
              <LogOut className="size-[1.125rem]" />
              <span className="sr-only">Log out</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
