import "server-only";

import { env } from "@/lib/env";
import { ConsoleMonitoringProvider } from "./console";
import { SentryMonitoringProvider } from "./sentry";
import type { MonitoringProvider } from "./types";

let instance: MonitoringProvider | undefined;

/**
 * The one place the app decides where errors go. Application code calls
 * `reportError(...)` and never imports a concrete provider.
 */
export function getMonitoringProvider(): MonitoringProvider {
  instance ??=
    env.MONITORING_PROVIDER === "sentry"
      ? new SentryMonitoringProvider()
      : new ConsoleMonitoringProvider();
  return instance;
}

/**
 * Report an exception. Safe to call from anywhere, including a catch block in
 * an error boundary — it never throws and never rejects.
 */
export async function reportError(
  error: unknown,
  context?: Parameters<MonitoringProvider["captureError"]>[1],
): Promise<void> {
  await getMonitoringProvider().captureError(error, context);
}

export async function reportMessage(
  message: string,
  context?: Parameters<MonitoringProvider["captureMessage"]>[1],
): Promise<void> {
  await getMonitoringProvider().captureMessage(message, context, "warning");
}

export * from "./types";
