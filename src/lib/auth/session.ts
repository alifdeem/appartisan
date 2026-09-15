import "server-only";

import { randomBytes } from "node:crypto";

import type { UserRole } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { syntheticEmailForPhone } from "@/lib/phone";

/**
 * Turning a verified phone number into a Supabase session.
 *
 * Supabase has no "trust me, this phone is verified" API, so the sequence is:
 *
 *   1. every user is backed by an auth.users row keyed on a synthetic email
 *      derived deterministically from their phone (`233241234567@phone…`);
 *   2. once our own OTP check passes, the service role mints a magic link for
 *      that email and immediately redeems the `token_hash` server-side;
 *   3. `verifyOtp` writes the session cookies through the SSR client.
 *
 * The synthetic email is never shown, never mailed to, and never usable as a
 * login route on its own — there is no password and no public email sign-in.
 * This is the shape we keep at go-live; only the SMS delivery changes.
 */

export interface SignUpInput {
  phone: string;
  fullName: string;
  role: Exclude<UserRole, "admin">;
  spokenLanguages?: string[];
}

/** Does an account already exist for this number? Drives login-vs-signup routing. */
export async function findUserByPhone(phone: string) {
  const admin = createAdminClient();

  const { data } = await admin
    .from("profiles")
    .select("id, role, full_name, is_active")
    .eq("phone", phone)
    .maybeSingle();

  return data ?? null;
}

export async function createUserForPhone({
  phone,
  fullName,
  role,
  spokenLanguages,
}: SignUpInput): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: syntheticEmailForPhone(phone),
    email_confirm: true,
    // Never used to sign in. Set to something unguessable rather than left
    // blank so the account cannot be password-attacked if email sign-in is
    // ever switched on by mistake.
    password: randomBytes(32).toString("hex"),
    user_metadata: {
      phone,
      full_name: fullName,
      role,
      spoken_languages: spokenLanguages ?? ["English"],
    },
  });

  if (error || !data.user) {
    // The database trigger raises on a duplicate phone; surface that plainly.
    const message = error?.message ?? "Could not create the account.";
    console.error("[auth] createUser failed", message);
    return {
      ok: false,
      error: /duplicate|already/i.test(message)
        ? "An account already exists for this number. Log in instead."
        : "Could not create the account. Try again.",
    };
  }

  return { ok: true, userId: data.user.id };
}

/**
 * Establish the cookie session for an already-OTP-verified phone number.
 * Callers MUST have verified the OTP first — this function does not check.
 */
export async function establishSession(
  phone: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const email = syntheticEmailForPhone(phone);

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !link.properties?.hashed_token) {
    console.error("[auth] generateLink failed", linkError);
    return { ok: false, error: "Could not sign you in. Try again." };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });

  if (verifyError) {
    console.error("[auth] verifyOtp(token_hash) failed", verifyError);
    return { ok: false, error: "Could not sign you in. Try again." };
  }

  return { ok: true };
}

/** Where a user belongs immediately after signing in. */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "provider":
      return "/provider";
    default:
      return "/client";
  }
}
