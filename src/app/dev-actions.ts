"use server";

import { redirect } from "next/navigation";

import { devToolsEnabled } from "@/lib/env";
import { establishSession, findUserByPhone, homePathForRole } from "@/lib/auth/session";
import { SEED_ACCOUNTS } from "@/lib/dev/seed-accounts";
import { createClient } from "@/lib/supabase/server";

/**
 * Dev role switcher.
 *
 * Signs straight into one of the three seeded accounts, skipping the OTP step.
 * This exists because I switch roles constantly while building, and re-running
 * the phone flow three times per feature is a tax on every change.
 *
 * Three separate locks, because an auth bypass reachable in production is the
 * worst bug this codebase could ship:
 *   1. `devToolsEnabled` is false whenever NODE_ENV === "production";
 *   2. the target phone must be one of the three hard-coded seed numbers;
 *   3. the account must already exist — this never creates one.
 */
export async function switchRoleAction(formData: FormData) {
  if (!devToolsEnabled) {
    throw new Error("Role switching is disabled outside development.");
  }

  const role = String(formData.get("role") ?? "");
  const account = SEED_ACCOUNTS.find((a) => a.role === role);

  if (!account) {
    throw new Error(`Unknown seed role: ${role}`);
  }

  const profile = await findUserByPhone(account.phone);
  if (!profile) {
    throw new Error(
      `No seeded ${role} account found. Run \`npm run db:seed\` to create the test accounts.`,
    );
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  const session = await establishSession(account.phone);
  if (!session.ok) throw new Error(session.error);

  redirect(homePathForRole(profile.role));
}
