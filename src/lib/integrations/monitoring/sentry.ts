import "server-only";

import { env } from "@/lib/env";
import { describe, type ErrorContext, type MonitoringProvider, type Severity } from "./types";

/**
 * Live error monitoring via Sentry.
 *
 * NOT YET EXERCISED — written so the shape is settled and the switch-over is a
 * config change, but no event has ever been sent through it. Treat the first
 * one as a genuine test, exactly as with the Paystack adapter.
 *
 * Deliberately posts to Sentry's HTTP store endpoint rather than pulling in
 * `@sentry/nextjs`. That package instruments the build, ships a client runtime,
 * and wants its own webpack plugin — about 40KB to the browser for something
 * whose entire job here is server-side aggregation. This app is for phones on
 * 3G in Accra; the endpoint takes plain JSON and costs nothing.
 *
 * The trade is no automatic breadcrumbs, no source-map symbolication and no
 * client-side capture. If the client later wants those, swapping this file for
 * the real SDK is a contained change — nothing outside this folder knows.
 */
export class SentryMonitoringProvider implements MonitoringProvider {
  readonly name = "sentry";
  readonly simulated = false;

  /** https://<key>@<host>/<project> → the store URL and the key. */
  private endpoint(): { url: string; key: string } | null {
    const dsn = env.SENTRY_DSN;
    if (!dsn) return null;

    try {
      const parsed = new URL(dsn);
      const projectId = parsed.pathname.replace(/^\//, "");
      return {
        url: `${parsed.protocol}//${parsed.host}/api/${projectId}/store/`,
        key: parsed.username,
      };
    } catch {
      console.error("[monitoring] SENTRY_DSN is not a valid DSN");
      return null;
    }
  }

  private async send(body: Record<string, unknown>): Promise<void> {
    const target = this.endpoint();
    if (!target) return;

    try {
      await fetch(target.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=artisangh/1.0`,
        },
        body: JSON.stringify({
          platform: "node",
          environment: env.NODE_ENV,
          timestamp: new Date().toISOString(),
          ...body,
        }),
        // Never let reporting hold a request open. If Sentry is slow or down,
        // the user's request must not wait on it.
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Swallowed on purpose — see the note on captureError in types.ts.
    }
  }

  async captureError(
    error: unknown,
    context?: ErrorContext,
    severity: Severity = "error",
  ): Promise<void> {
    const { message, stack } = describe(error);

    await this.send({
      level: severity,
      logger: context?.scope ?? "app",
      message,
      extra: { stack, ...context?.extra },
      ...(context?.userId ? { user: { id: context.userId } } : {}),
    });
  }

  async captureMessage(
    message: string,
    context?: ErrorContext,
    severity: Severity = "info",
  ): Promise<void> {
    const { message: safe } = describe(message);

    await this.send({
      level: severity,
      logger: context?.scope ?? "app",
      message: safe,
      ...(context?.extra ? { extra: context.extra } : {}),
      ...(context?.userId ? { user: { id: context.userId } } : {}),
    });
  }
}
