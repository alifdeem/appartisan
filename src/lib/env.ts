import "server-only";

import { z } from "zod";

/**
 * Server-side environment. Validated once at module load so a missing or
 * malformed variable fails loudly at boot rather than at 2am inside a payment
 * webhook.
 *
 * Client-side config lives in `env.public.ts` — this module imports
 * `server-only` and will hard-error if it is ever pulled into a client bundle.
 */

const providerMode = z.enum(["mock", "live"]);

const schema = z.object({
  // --- Supabase ---------------------------------------------------------
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: "NEXT_PUBLIC_SUPABASE_URL must be the full https URL of your Supabase project",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, {
    message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing (called the 'publishable key' in newer Supabase dashboards)",
  }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, {
    message: "SUPABASE_SERVICE_ROLE_KEY is missing (called the 'secret key' in newer Supabase dashboards)",
  }),

  // --- App --------------------------------------------------------------
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- Integration providers -------------------------------------------
  // Every paid integration sits behind an adapter. `mock` costs nothing and
  // exercises the same code paths; `live` talks to the real service.
  PAYMENT_PROVIDER: providerMode.default("mock"),
  SMS_PROVIDER: providerMode.default("mock"),
  MAP_PROVIDER: z.enum(["osm", "google"]).default("osm"),

  // --- Guardrail --------------------------------------------------------
  ALLOW_MOCK_IN_PROD: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  // --- Dev tooling ------------------------------------------------------
  DEV_OTP_CODE: z
    .string()
    .regex(/^\d{6}$/, "DEV_OTP_CODE must be exactly 6 digits")
    .default("000000"),
  ENABLE_DEV_TOOLS: z
    .string()
    .optional()
    .transform((v) => v !== "false"),

  // --- Live credentials, not needed until go-live -----------------------
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  ARKESEL_API_KEY: z.string().optional(),
  ARKESEL_SENDER_ID: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
});

function load() {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\n` +
        `Copy .env.example to .env.local and fill in the values.\n`,
    );
  }

  const value = parsed.data;

  /**
   * THE GUARDRAIL.
   *
   * A mock payment provider silently running in production is the kind of
   * mistake that is obvious in hindsight and catastrophic in the moment —
   * jobs complete, invoices generate, artisans expect payouts, and no money
   * ever moved. Refuse to boot instead.
   *
   * `ALLOW_MOCK_IN_PROD=true` exists as a deliberate escape hatch for the
   * client demo period, when the app is deployed to a real URL but the
   * business is not yet registered with Paystack.
   */
  if (value.NODE_ENV === "production" && !value.ALLOW_MOCK_IN_PROD) {
    const mocked = [
      value.PAYMENT_PROVIDER === "mock" ? "PAYMENT_PROVIDER" : null,
      value.SMS_PROVIDER === "mock" ? "SMS_PROVIDER" : null,
    ].filter(Boolean);

    if (mocked.length > 0) {
      // `next build` runs with NODE_ENV=production, so an unqualified throw
      // here would make the app un-buildable for the whole simulation phase.
      // A build is not a running server — the check belongs at boot, where a
      // real request could actually be served against a mock.
      if (process.env.NEXT_PHASE === "phase-production-build") {
        console.warn(
          `\n  ⚠ Building with ${mocked.join(", ")} set to "mock".\n` +
            `    This build will REFUSE TO BOOT unless ALLOW_MOCK_IN_PROD=true is set\n` +
            `    in the deployment environment. That is deliberate — see PLAN.md §3.\n`,
        );
      } else {
        throw new Error(
          `Refusing to start: ${mocked.join(", ")} set to "mock" in production.\n` +
            `No real money or messages would move, but the app would behave as though they had.\n` +
            `Set them to "live" and supply credentials, or set ALLOW_MOCK_IN_PROD=true ` +
            `if this is a deliberate pre-launch demo deployment.`,
        );
      }
    }
  }

  // Live mode needs credentials. Catch this at boot, not at first charge.
  if (value.PAYMENT_PROVIDER === "live" && !value.PAYSTACK_SECRET_KEY) {
    throw new Error("PAYMENT_PROVIDER=live requires PAYSTACK_SECRET_KEY");
  }
  if (value.SMS_PROVIDER === "live" && !value.ARKESEL_API_KEY) {
    throw new Error("SMS_PROVIDER=live requires ARKESEL_API_KEY");
  }
  if (value.MAP_PROVIDER === "google" && !value.GOOGLE_MAPS_API_KEY) {
    throw new Error("MAP_PROVIDER=google requires GOOGLE_MAPS_API_KEY");
  }

  return value;
}

export const env = load();

/** True when any paid integration is running against a mock. */
export const isSimulated = env.PAYMENT_PROVIDER === "mock" || env.SMS_PROVIDER === "mock";

/** Dev-only affordances (role switcher, OTP banner, forced payment outcomes). */
export const devToolsEnabled = env.NODE_ENV !== "production" && env.ENABLE_DEV_TOOLS;
