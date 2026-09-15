import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role client. Bypasses row level security entirely.
 *
 * Legitimate uses are narrow and deliberate:
 *   • OTP issue/verify and account provisioning (the user has no session yet)
 *   • payment webhook handling (the request comes from Paystack, not a user)
 *   • the seed script
 *
 * Everything else must go through `createClient()` from `./server` so RLS is
 * actually enforced. If you find yourself reaching for this to "make a query
 * work", the real problem is a missing policy.
 *
 * Never import this into a Client Component. The `server-only` import above
 * turns that into a build error rather than a leaked secret.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
