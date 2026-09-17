import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Request proxy — Next 16's replacement for `middleware.ts`.
 *
 * Two jobs, in this order:
 *
 *  1. Refresh the Supabase session on every request. Without this the access
 *     token expires mid-session and Server Components start seeing a logged-out
 *     user at random. The cookie writes MUST go onto the response object we
 *     ultimately return — cloning it later silently drops them.
 *  2. Enforce role boundaries at the edge, so a client cannot load an admin
 *     route even for the instant before the page redirects. RLS is still the
 *     real defence (this only reads a cookie-derived claim), but a user should
 *     never see a screen that is not theirs.
 */

const ROLE_PREFIXES = {
  client: "/client",
  provider: "/provider",
  admin: "/admin",
} as const;

type Role = keyof typeof ROLE_PREFIXES;

/** Routes reachable without a session. Everything else requires one. */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/how-it-works", "/for-artisans", "/legal"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  /**
   * Cookies Supabase asked us to write during this request, kept aside so they
   * can be replayed onto a redirect.
   *
   * This matters more than it looks. When the access token has expired,
   * `getUser()` below spends the refresh token and receives a new pair. If that
   * same request then returns a *fresh* `NextResponse.redirect(...)`, the new
   * pair never reaches the browser — but the old refresh token has already been
   * consumed server-side. The next request presents it again and Supabase
   * answers `refresh_token_already_used`, so the user is silently logged out.
   *
   * It stays invisible for the first hour of any session (nothing needs
   * refreshing, so nothing is lost) and then starts logging people out at
   * exactly the moments a redirect is most likely — landing on the wrong wing,
   * or opening /login while already signed in.
   */
  const pendingCookies: { name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] }[] = [];

  /**
   * Server Actions POST back to whatever URL the page was rendered under, and
   * they speak their own wire protocol. A 307 to somewhere else is not part of
   * it — the client throws "An unexpected response was received from the
   * server" and the action never runs.
   *
   * That collides with the "signed in? bounce away from /login" rule below: a
   * form rendered on /login keeps posting to /login, so the first action a user
   * triggers after signing in gets redirected and fails. Actions are therefore
   * let through and left to check their own caller. No boundary is lost — this
   * proxy was never the boundary (see the header comment); RLS is.
   */
  const isServerAction = request.method === "POST" && request.headers.has("next-action");

  /** Redirect while preserving any refreshed session cookies. */
  const redirectTo = (url: URL) => {
    if (isServerAction) return response;

    const redirect = NextResponse.redirect(url);
    for (const { name, value, options } of pendingCookies) {
      redirect.cookies.set(name, value, options);
    }
    return redirect;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
            pendingCookies.push({ name, value, options });
          }
        },
      },
    },
  );

  // getUser(), not getSession() — getSession trusts the cookie without
  // revalidating it, which is exactly the wrong property for an auth gate.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user) {
    if (isPublic(pathname)) return response;

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return redirectTo(loginUrl);
  }

  // Signed in. Read the role once — profiles is tiny and indexed by primary key.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const role = (profile?.role ?? "client") as Role;
  const home = ROLE_PREFIXES[role];

  if (profile && !profile.is_active && pathname !== "/deactivated") {
    const url = request.nextUrl.clone();
    url.pathname = "/deactivated";
    url.search = "";
    return redirectTo(url);
  }

  // Already signed in? The auth screens are pointless — send them home.
  if (pathname === "/login" || pathname === "/signup") {
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return redirectTo(url);
  }

  // Wrong wing of the app.
  for (const [prefix, base] of Object.entries(ROLE_PREFIXES) as [Role, string][]) {
    if (pathname.startsWith(base) && prefix !== role) {
      const url = request.nextUrl.clone();
      url.pathname = home;
      url.search = "";
      return redirectTo(url);
    }
  }

  return response;
}

export const config = {
  /**
   * Skip static assets and image optimisation — running an auth round-trip for
   * every SVG is pure latency.
   *
   * `api/cron` is excluded for a different and more serious reason. Those
   * routes carry a bearer token, not a session cookie, so the proxy saw no user
   * and 307'd them to /login — every one of them, silently. A scheduler follows
   * the redirect, gets a 200 back from the login page, and reports success, so
   * the platform looks healthy while the offer sweep never expires an offer and
   * the payment reconciliation never reconciles anything. It survived until now
   * because the e2e suites call the RPCs directly rather than over HTTP.
   * `api/webhooks` was already excluded for exactly this reason.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
