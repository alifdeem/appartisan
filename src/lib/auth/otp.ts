import "server-only";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { getSmsProvider } from "@/lib/integrations/sms";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Phone OTP.
 *
 * Supabase's built-in phone auth only speaks Twilio / MessageBird / Vonage /
 * Textlocal, and we send through Arkesel. So the challenge lives in our own
 * `otp_challenges` table and the resulting Supabase session is minted
 * separately (see `session.ts`). This is the design we want at go-live too, not
 * a simulation shortcut — only the SMS adapter changes.
 *
 * Codes are stored as SHA-256 of `code:phone`. Salting with the phone means a
 * stolen table dump cannot be attacked with one rainbow table across all rows,
 * and a hash of a six-digit code is cheap to verify on every attempt.
 */

const CODE_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
/** Per phone, per hour. Loose enough for a confused user, tight enough to hurt. */
const MAX_SENDS_PER_HOUR = 6;

export type OtpPurpose = "login" | "signup";

function hashCode(code: string, phone: string): string {
  return createHash("sha256").update(`${code}:${phone}`).digest("hex");
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * In simulation the code is fixed (default `000000`) so the client can demo the
 * app without an SMS bill, and so the three seeded accounts are trivially
 * reachable. In live mode it is a real CSPRNG draw.
 */
function generateCode(): string {
  if (env.SMS_PROVIDER === "mock") return env.DEV_OTP_CODE;
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export interface IssueOtpResult {
  ok: boolean;
  error?: string;
  /** Seconds the caller must wait before another send is allowed. */
  retryAfter?: number;
  /** Only ever populated in simulation — surfaced in the dev banner, never in prod. */
  devCode?: string;
  simulated: boolean;
}

export async function issueOtp({
  phone,
  purpose,
  fullName,
  ip,
}: {
  phone: string;
  purpose: OtpPurpose;
  fullName?: string;
  ip?: string;
}): Promise<IssueOtpResult> {
  const admin = createAdminClient();
  const sms = getSmsProvider();

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent, error: recentError } = await admin
    .from("otp_challenges")
    .select("id, created_at")
    .eq("phone", phone)
    .gte("created_at", hourAgo)
    .order("created_at", { ascending: false });

  if (recentError) {
    console.error("[otp] could not read recent challenges", recentError);
    return { ok: false, error: "Could not send a code right now. Try again.", simulated: sms.simulated };
  }

  /**
   * Per-IP, across every number.
   *
   * The per-number limits below cannot see the attack that actually costs
   * money: every Ghanaian mobile prefix is public, so one host can walk
   * 024xxxxxxx upward and pay for an SMS on each step while never asking for
   * the same number twice. PLAN.md §13 asks for "per number and per IP"; this
   * is the second half, and it went unbuilt until Phase 7 even though
   * `created_ip` has been written since Phase 0.
   *
   * Checked before the cooldown so a flood is turned away on the cheapest
   * possible query rather than after two more round trips.
   */
  if (ip) {
    const { data: throttled, error: throttleError } = await admin.rpc("otp_ip_throttled", {
      p_ip: ip,
    });

    if (throttleError) {
      // Fail open, deliberately. This check protects a budget; the per-number
      // limits protect the user. Turning a broken RPC into a login outage
      // trades a small cost risk for a total one.
      console.error("[otp] ip throttle check failed", throttleError.message);
    } else if (throttled) {
      console.warn(`[otp] refused — ip ${ip} over the hourly cap`);
      return {
        ok: false,
        error: "Too many codes requested from this connection. Try again in an hour.",
        retryAfter: 3600,
        simulated: sms.simulated,
      };
    }
  }

  /**
   * The circuit breaker. Only counts real spend, so the simulation phase does
   * not consume a budget that has not started yet.
   */
  if (!sms.simulated) {
    const { data: exhausted, error: budgetError } = await admin.rpc("sms_budget_exhausted");

    if (budgetError) {
      console.error("[otp] budget check failed", budgetError.message);
    } else if (exhausted) {
      // Loud, because this is either an attack in progress or a genuine day of
      // traffic nobody planned for, and both want a human.
      console.error("[otp] REFUSED — daily SMS cap reached; no more codes will send today");
      return {
        ok: false,
        error: "We cannot send codes right now. Please try again later or contact support.",
        simulated: sms.simulated,
      };
    }
  }

  if (recent && recent.length > 0) {
    const last = new Date(recent[0].created_at).getTime();
    const elapsed = Math.floor((Date.now() - last) / 1000);
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      return {
        ok: false,
        error: `Wait ${RESEND_COOLDOWN_SECONDS - elapsed}s before requesting another code.`,
        retryAfter: RESEND_COOLDOWN_SECONDS - elapsed,
        simulated: sms.simulated,
      };
    }
    if (recent.length >= MAX_SENDS_PER_HOUR) {
      return {
        ok: false,
        error: "Too many codes requested for this number. Try again in an hour.",
        retryAfter: 3600,
        simulated: sms.simulated,
      };
    }
  }

  const code = generateCode();

  // Any earlier live challenge for this phone is retired, so a user who
  // requests twice cannot be confused about which code is valid.
  await admin
    .from("otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("phone", phone)
    .is("consumed_at", null);

  const { error: insertError } = await admin.from("otp_challenges").insert({
    phone,
    code_hash: hashCode(code, phone),
    purpose,
    expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
    created_ip: ip ?? null,
  });

  if (insertError) {
    console.error("[otp] could not store challenge", insertError);
    return { ok: false, error: "Could not send a code right now. Try again.", simulated: sms.simulated };
  }

  // Plain ASCII, under 160 characters — see the note on billing in sms/types.ts.
  const body =
    purpose === "signup"
      ? `${code} is your ArtisanGH signup code${fullName ? `, ${fullName.split(" ")[0]}` : ""}. It expires in 10 minutes. Do not share it.`
      : `${code} is your ArtisanGH login code. It expires in 10 minutes. Do not share it with anyone.`;

  const result = await sms.send({
    to: phone,
    template: purpose === "signup" ? "otp_signup" : "otp_login",
    body,
  });

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not send the code.", simulated: sms.simulated };
  }

  return {
    ok: true,
    simulated: result.simulated,
    devCode: result.simulated ? code : undefined,
  };
}

export type VerifyOtpResult =
  | { ok: true; phone: string; purpose: OtpPurpose }
  | { ok: false; error: string; attemptsLeft?: number };

export async function verifyOtpCode({
  phone,
  code,
}: {
  phone: string;
  code: string;
}): Promise<VerifyOtpResult> {
  const admin = createAdminClient();

  const { data: challenge } = await admin
    .from("otp_challenges")
    .select("id, code_hash, attempts, max_attempts, expires_at, purpose")
    .eq("phone", phone)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challenge) {
    return { ok: false, error: "That code has expired. Request a new one." };
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    await admin
      .from("otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id);
    return { ok: false, error: "That code has expired. Request a new one." };
  }

  if (challenge.attempts >= challenge.max_attempts) {
    await admin
      .from("otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id);
    return { ok: false, error: "Too many incorrect attempts. Request a new code." };
  }

  if (!constantTimeEqual(hashCode(code, phone), challenge.code_hash)) {
    const attempts = challenge.attempts + 1;
    await admin.from("otp_challenges").update({ attempts }).eq("id", challenge.id);
    const attemptsLeft = challenge.max_attempts - attempts;
    return {
      ok: false,
      error:
        attemptsLeft > 0
          ? `Incorrect code. ${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} left.`
          : "Too many incorrect attempts. Request a new code.",
      attemptsLeft: Math.max(0, attemptsLeft),
    };
  }

  // Burn it. A correct code is single-use even within its TTL.
  await admin
    .from("otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challenge.id);

  return { ok: true, phone, purpose: challenge.purpose as OtpPurpose };
}
