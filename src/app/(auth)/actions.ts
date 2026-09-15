"use server";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { devToolsEnabled } from "@/lib/env";
import { issueOtp, verifyOtpCode } from "@/lib/auth/otp";
import {
  createUserForPhone,
  establishSession,
  findUserByPhone,
  homePathForRole,
} from "@/lib/auth/session";
import { normalisePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth server actions.
 *
 * Two deliberate choices here:
 *
 *  • The phone step never reveals whether an account exists. "Send code"
 *    behaves identically either way, and the *client* tells us which flow it
 *    is on. Otherwise this form becomes a free lookup for whether a given
 *    Ghanaian number is registered.
 *  • The account is only created AFTER the code is verified, so an abandoned
 *    signup leaves nothing behind and a number cannot be squatted by someone
 *    who does not control it.
 */

const phoneSchema = z
  .string()
  .transform((v) => normalisePhone(v))
  .refine((v): v is string => v !== null, {
    message: "Enter a valid Ghana mobile number, e.g. 024 123 4567",
  });

const requestSchema = z.object({
  phone: phoneSchema,
  mode: z.enum(["login", "signup"]),
  fullName: z.string().trim().min(2, "Enter your full name").max(80).optional(),
});

export interface ActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so the verify step knows the canonical E.164 form. */
  phone?: string;
  /** Populated in simulation only — the login screen shows it in a dev banner. */
  devCode?: string;
  simulated?: boolean;
  /**
   * Unique per action result. Lets the form derive "has something new happened"
   * during render instead of mirroring the action result into local state
   * inside an effect, which React 19 rightly flags as a cascading render.
   */
  token: string;
}

/** Every return path goes through here so `token` can never be forgotten. */
function state(value: Omit<ActionState, "token">): ActionState {
  return { ...value, token: randomUUID() };
}

async function callerIp(): Promise<string | undefined> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
}

export async function requestCodeAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestSchema.safeParse({
    phone: formData.get("phone"),
    mode: formData.get("mode"),
    fullName: formData.get("fullName") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return state({ ok: false, fieldErrors });
  }

  const { phone, mode, fullName } = parsed.data;

  if (mode === "signup" && !fullName) {
    return state({ ok: false, fieldErrors: { fullName: "Enter your full name" } });
  }

  // Guard the obvious mismatches without leaking existence on the login path:
  // a signup for a number that already exists is a dead end either way, so it
  // is fair to say so; a login for an unknown number is not, so it is not.
  const existing = await findUserByPhone(phone);

  if (mode === "signup" && existing) {
    return state({
      ok: false,
      fieldErrors: { phone: "An account already exists for this number. Log in instead." },
    });
  }

  if (existing && !existing.is_active) {
    return state({ ok: false, error: "This account has been deactivated. Contact support." });
  }

  const result = await issueOtp({
    phone,
    purpose: mode,
    fullName,
    ip: await callerIp(),
  });

  if (!result.ok) {
    return state({ ok: false, error: result.error });
  }

  return state({
    ok: true,
    phone,
    simulated: result.simulated,
    devCode: devToolsEnabled ? result.devCode : undefined,
  });
}

const verifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  mode: z.enum(["login", "signup"]),
  fullName: z.string().trim().min(2).max(80).optional(),
  role: z.enum(["client", "provider"]).optional(),
  spokenLanguages: z.string().optional(),
});

export async function verifyCodeAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = verifySchema.safeParse({
    phone: formData.get("phone"),
    code: formData.get("code"),
    mode: formData.get("mode"),
    fullName: formData.get("fullName") || undefined,
    role: formData.get("role") || undefined,
    spokenLanguages: formData.get("spokenLanguages") || undefined,
  });

  if (!parsed.success) {
    return state({ ok: false, error: parsed.error.issues[0]?.message ?? "Enter the 6-digit code" });
  }

  const { phone, code, mode, fullName, role, spokenLanguages } = parsed.data;

  const verification = await verifyOtpCode({ phone, code });
  if (!verification.ok) {
    return state({ ok: false, error: verification.error, phone });
  }

  let profileRole: "client" | "provider" | "admin";

  if (mode === "signup") {
    const languages = spokenLanguages
      ? spokenLanguages.split(",").map((l) => l.trim()).filter(Boolean)
      : ["English"];

    const created = await createUserForPhone({
      phone,
      fullName: fullName ?? "ArtisanGH user",
      role: role ?? "client",
      spokenLanguages: languages.length > 0 ? languages : ["English"],
    });

    if (!created.ok) return state({ ok: false, error: created.error, phone });
    profileRole = role ?? "client";
  } else {
    const existing = await findUserByPhone(phone);
    if (!existing) {
      // Verified a code for a number with no account. Send them to signup
      // rather than silently creating one with no name.
      return state({
        ok: false,
        error: "No account found for this number. Create one instead.",
        phone,
      });
    }
    if (!existing.is_active) {
      return state({ ok: false, error: "This account has been deactivated. Contact support.", phone });
    }
    profileRole = existing.role;
  }

  const session = await establishSession(phone);
  if (!session.ok) return state({ ok: false, error: session.error, phone });

  redirect(homePathForRole(profileRole));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
