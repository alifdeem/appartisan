/**
 * Client-safe configuration. Only NEXT_PUBLIC_* values, which Next inlines at
 * build time — so they must be referenced as full literal property accesses,
 * not looked up dynamically.
 *
 * Server code should import from `./env` instead, which validates the full set
 * including secrets.
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  mapProvider: (process.env.NEXT_PUBLIC_MAP_PROVIDER ?? "osm") as "osm" | "google",
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  /** Controls the dev role switcher and OTP hint banner in the browser. */
  devTools: process.env.NEXT_PUBLIC_DEV_TOOLS === "true",
} as const;
