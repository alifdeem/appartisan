import { SplashScreen } from "@/components/mobile/splash-screen";

/**
 * Root route loading fallback.
 *
 * Next renders this the moment a navigation starts and swaps it out when the
 * segment's data resolves — so it costs nothing on a fast route and is honest
 * feedback on a slow one. See the note in `splash-screen.tsx` for why this is a
 * Suspense fallback rather than a timed splash.
 *
 * This is the app-wide default. Individual segments should add their own
 * `loading.tsx` with a skeleton that matches their layout: a skeleton shaped
 * like the screen you are about to get beats a logo, because it tells you where
 * things will be. The logo is the right fallback only at the root, where we do
 * not yet know which screen is coming.
 */
export default function Loading() {
  return <SplashScreen />;
}
