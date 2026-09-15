"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env.public";
import type { Database } from "@/lib/supabase/types";

let cached: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser-side Supabase client. Singleton, so realtime channels are shared. */
export function createClient() {
  cached ??= createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return cached;
}
