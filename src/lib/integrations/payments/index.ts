import "server-only";

import { env } from "@/lib/env";
import { MockPaymentProvider } from "./mock";
import { PaystackPaymentProvider } from "./paystack";
import type { PaymentProvider } from "./types";

let instance: PaymentProvider | undefined;

/**
 * The one place the app decides which payment implementation is in play.
 * Application code calls `getPaymentProvider()` and never imports Paystack.
 */
export function getPaymentProvider(): PaymentProvider {
  instance ??=
    env.PAYMENT_PROVIDER === "live" ? new PaystackPaymentProvider() : new MockPaymentProvider();
  return instance;
}

/**
 * The mock, for code that genuinely needs simulation-only behaviour (the fake
 * MoMo prompt screen and the dev panel). Throws in live mode rather than
 * silently doing nothing.
 */
export function getMockPaymentProvider(): MockPaymentProvider {
  const provider = getPaymentProvider();
  if (!(provider instanceof MockPaymentProvider)) {
    throw new Error("Simulation controls are unavailable when PAYMENT_PROVIDER=live");
  }
  return provider;
}

export * from "./types";
