"use server";

import { reportError } from "@/lib/integrations/monitoring";
import { getCurrentProfile } from "@/lib/supabase/server";

/**
 * The bridge from a client error boundary to the server-side monitor.
 *
 * The boundary is a Client Component, and the monitoring adapter is
 * `server-only` — deliberately, because the live provider holds a DSN and
 * because an error tracker reachable from the browser is an error tracker
 * anyone can flood.
 *
 * Takes the already-extracted fields rather than an Error: a thrown value does
 * not survive the Server Action boundary intact, and passing `message`,
 * `digest` and `stack` explicitly makes it obvious what crosses.
 */
export async function reportClientErrorAction(input: {
  message: string;
  digest?: string;
  stack?: string;
}): Promise<void> {
  // Best effort. Nothing here may throw — this runs while the app is already
  // showing an error screen, and a failure would replace it with a worse one.
  try {
    const profile = await getCurrentProfile().catch(() => null);

    await reportError(new Error(input.message), {
      scope: "client:boundary",
      userId: profile?.id,
      extra: {
        digest: input.digest,
        stack: input.stack,
      },
    });
  } catch {
    /* swallowed on purpose */
  }
}
