"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { reportClientErrorAction } from "@/app/error-actions";
import { Button } from "@/components/ui/button";

/**
 * The error boundary.
 *
 * Until now a thrown Server Component showed the default Next.js error screen:
 * a stack trace in development and a bare "Application error" in production.
 * Neither tells a client in Accra whether their deposit went through.
 *
 * Two jobs, in this order:
 *
 *  1. Say something true and useful. "Something went wrong on our side" plus a
 *     way back, and — because this is a product about money — an explicit
 *     reassurance that nothing was charged twice, since that is the actual
 *     question in the user's head.
 *  2. Report it. Next gives the boundary a `digest` that matches the server
 *     log line, so the two can be tied together without the user reading a
 *     stack trace.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A genuine side effect of rendering this screen, so an effect is right.
  // Keyed on the digest so a second, different failure reports again.
  React.useEffect(() => {
    void reportClientErrorAction({
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error.digest, error.message, error.stack]);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md space-y-5 rounded-card border border-hairline bg-white p-6 text-center shadow-sm">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-navy-900">Something went wrong</h1>
          <p className="text-[0.9375rem] text-copy-muted">
            That is our fault, not yours. It has been reported and someone will look at it.
          </p>
        </div>

        {/* The question anyone using this app actually has. */}
        <p className="rounded-field bg-canvas px-3 py-2 text-sm text-copy-muted">
          No payment was taken or repeated because of this. Your jobs and money are unaffected.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" onClick={reset}>
            <RotateCcw />
            Try again
          </Button>
          <Link href="/">
            <Button variant="secondary" block>
              Go home
            </Button>
          </Link>
        </div>

        {/* Shown so somebody reporting this by phone can read it out, and it
            matches the server log line exactly. */}
        {error.digest && (
          <p className="tabular font-mono text-[0.6875rem] tracking-wide text-copy-muted uppercase">
            Reference {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
