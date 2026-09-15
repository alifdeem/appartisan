import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Supabase client bound to the caller's session, for use in Server Components,
 * Server Actions and Route Handlers.
 *
 * Next 16: `cookies()` is async — synchronous access was removed entirely.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, where cookies are
            // read-only. Safe to ignore: the proxy refreshes the session on
            // every request, so the cookie is written there instead.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user's profile, or null. Use this rather than
 * `supabase.auth.getUser()` directly when you need the role.
 */
export async function getCurrentProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, phone, full_name, avatar_url, spoken_languages, is_active")
    .eq("id", user.id)
    .single();

  return profile ?? null;
}
