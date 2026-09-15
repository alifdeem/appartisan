import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Without this, Turbopack walks up looking for a lockfile, finds the one in
   * ~/ and takes the home directory as the project root — which pulls unrelated
   * files into the build trace and slows every compile down.
   */
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },

  images: {
    remotePatterns: [
      // Supabase Storage: avatars are public, job photos are served as signed
      // URLs off the same host.
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },

  // Fail the production build on a type error rather than shipping it. Already
  // the default; stated explicitly so nobody "temporarily" flips it on to get a
  // deploy out and then forgets. (Next 16 dropped the matching `eslint` key —
  // linting is a separate `npm run lint` step now.)
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
