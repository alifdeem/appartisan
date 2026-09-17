/**
 * Error monitoring (PLAN.md §12, Phase 7).
 *
 * Behind an adapter like payments, SMS and maps, and for the same reason:
 * nothing that costs money or needs an account gets wired up before the
 * client's business is registered, but the code path that will use it is
 * written and exercised now (§3).
 *
 * The thing being bought here is not "we saw the error" — the server already
 * logs to stdout and Vercel keeps that. It is *aggregation*: the same
 * exception thrown four hundred times by one broken RPC should be one entry
 * with a count, not four hundred lines nobody reads.
 */

export type Severity = "fatal" | "error" | "warning" | "info";

export interface ErrorContext {
  /** Which part of the system — "webhook:payments", "cron:matching". */
  scope?: string;
  /** The signed-in user, when there is one. Never their phone or name. */
  userId?: string;
  /** Anything else worth having at 2am. Must not carry personal data. */
  extra?: Record<string, unknown>;
}

export interface MonitoringProvider {
  readonly name: string;
  readonly simulated: boolean;

  /**
   * Report an exception. Must never throw and must never reject — a monitoring
   * call that takes down the request it was reporting on is worse than no
   * monitoring, and this is called from catch blocks and error boundaries
   * where there is nothing left to catch it.
   */
  captureError(error: unknown, context?: ErrorContext, severity?: Severity): Promise<void>;

  /** A noteworthy event that is not an exception. */
  captureMessage(message: string, context?: ErrorContext, severity?: Severity): Promise<void>;
}

/**
 * Personal data must not reach a third-party error tracker: PLAN.md §13 lists
 * Data Protection Act compliance as a live risk, and an exception message is
 * exactly where a phone number or an address ends up by accident.
 *
 * Ghanaian numbers are the specific hazard — phone IS identity in this product,
 * so they appear in error strings constantly.
 */
export function redact(input: string): string {
  return input
    // +233XXXXXXXXX and 0XXXXXXXXX
    .replace(/\+233\d{9}\b/g, "+233[redacted]")
    .replace(/\b0\d{9}\b/g, "0[redacted]")
    // The synthetic auth emails, which contain the number
    .replace(/\b\d{12}@phone\.artisangh\.app\b/g, "[redacted]@phone.artisangh.app")
    // Ghana Card, e.g. GHA-123456789-0
    .replace(/\bGHA-\d{9}-\d\b/gi, "GHA-[redacted]")
    // Anything that looks like a bearer token or a Supabase key
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]")
    .replace(/\bsbp_[a-f0-9]{40,}\b/gi, "[token]");
}

export function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: redact(error.message),
      stack: error.stack ? redact(error.stack) : undefined,
    };
  }
  return { message: redact(typeof error === "string" ? error : JSON.stringify(error)) };
}
