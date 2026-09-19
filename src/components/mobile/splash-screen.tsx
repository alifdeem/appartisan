import { Logo } from "@/components/brand/logo";

/**
 * The loading screen.
 *
 * Deliberately *not* a timed splash. A native app shows its logo while it boots
 * because it genuinely is booting; a web page that holds a logo up for 1.5s
 * before showing content has just added 1.5s of latency and called it branding.
 * So this is wired to `loading.tsx` — React Suspense route fallbacks — and
 * appears exactly as long as a navigation actually takes. Fast route: a flicker
 * or nothing at all. Slow route: honest feedback.
 *
 * It also closes the biggest gap the audit found: zero `loading.tsx` files in a
 * codebase where every page awaits `Promise.all` of database queries, so every
 * navigation was a dead white screen.
 *
 * The indicator is an indeterminate sweep under the wordmark rather than a
 * spinner beside it — the Uber / Revolut / Monzo pattern. A spinner next to a
 * logo reads as "this broke"; a bar under a logo reads as "this is working". It
 * never claims a percentage, because there is no progress to report, only
 * liveness. Reduced motion holds a dimmed static bar instead — see the
 * `.loader-sweep` note in globals.css for why the blanket rule cannot handle
 * this one.
 */

/** Matches `package.json`. Shown per the reference's splash. */
const VERSION = "0.1.0";

export function SplashScreen({ version = VERSION }: { version?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-6">
      {/* The lockup sits slightly above centre. Optical centre is a little
          above geometric centre, and the version line below pulls the
          composition down if the logo is placed at true middle. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-7 pb-10">
        <Logo size="lg" />

        {/* w-1/3 is load-bearing: the sweep keyframe's 300% end position is
            derived from it. See the `indeterminate` note in globals.css. */}
        <div
          className="h-0.5 w-32 overflow-hidden rounded-full bg-ink-100"
          role="status"
          aria-label="Loading"
        >
          <div className="loader-sweep h-full w-1/3 rounded-full bg-brand-700" />
        </div>
      </div>

      <p className="tabular pb-8 font-mono text-2xs text-ink-400">Version {version}</p>
    </div>
  );
}
