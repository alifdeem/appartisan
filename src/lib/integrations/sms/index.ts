import "server-only";

import { env } from "@/lib/env";
import { ArkeselSmsProvider } from "./arkesel";
import { MockSmsProvider } from "./mock";
import type { SmsProvider } from "./types";

let instance: SmsProvider | undefined;

/**
 * The one place the app decides which SMS implementation is in play.
 * Application code calls `getSmsProvider().send(...)` and never imports a
 * concrete provider.
 */
export function getSmsProvider(): SmsProvider {
  instance ??= env.SMS_PROVIDER === "live" ? new ArkeselSmsProvider() : new MockSmsProvider();
  return instance;
}

export * from "./types";
