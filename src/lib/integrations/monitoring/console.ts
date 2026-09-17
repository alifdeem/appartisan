import "server-only";

import { describe, type ErrorContext, type MonitoringProvider, type Severity } from "./types";

/**
 * The simulated monitor.
 *
 * Writes one structured line per event to stdout, which Vercel captures and
 * which `grep` can read locally. It is not a substitute for aggregation — the
 * whole point of the live provider — but it means the call sites are real and
 * exercised from today, so switching to Sentry is a config change rather than
 * a retrofit of every catch block (PLAN.md §3).
 *
 * One line, JSON, on a single `console.error` call: interleaved multi-line
 * output from concurrent requests is unreadable, and the thing you do with
 * production logs is search them.
 */
export class ConsoleMonitoringProvider implements MonitoringProvider {
  readonly name = "console";
  readonly simulated = true;

  private write(
    severity: Severity,
    payload: Record<string, unknown>,
    context?: ErrorContext,
  ): void {
    const line = JSON.stringify({
      monitor: severity,
      scope: context?.scope ?? "app",
      at: new Date().toISOString(),
      ...payload,
      ...(context?.userId ? { userId: context.userId } : {}),
      ...(context?.extra ? { extra: context.extra } : {}),
    });

    if (severity === "fatal" || severity === "error") console.error(line);
    else if (severity === "warning") console.warn(line);
    else console.log(line);
  }

  async captureError(
    error: unknown,
    context?: ErrorContext,
    severity: Severity = "error",
  ): Promise<void> {
    try {
      const { message, stack } = describe(error);
      this.write(severity, { message, stack }, context);
    } catch {
      // Deliberately silent. This is called from catch blocks and error
      // boundaries; throwing from here replaces a handled error with an
      // unhandled one.
    }
  }

  async captureMessage(
    message: string,
    context?: ErrorContext,
    severity: Severity = "info",
  ): Promise<void> {
    try {
      this.write(severity, { message }, context);
    } catch {
      /* see above */
    }
  }
}
