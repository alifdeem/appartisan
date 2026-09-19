/**
 * Auth shell — now a pass-through.
 *
 * This used to be a two-column desktop split: form on the left, a photograph
 * and the verification promise on the right. That was the right answer for the
 * previous, desktop-led design and is the wrong one now. These screens are
 * built mobile-first against the new reference (`redesign/new-reference-shots`),
 * they render as a centred ~400px column at every width, and each one owns its
 * own chrome through `<MobileScreen>` and `<ScreenHeader>` — a back button that
 * belongs to the screen, not a logo bar that belongs to the layout.
 *
 * A layout that wrapped them would fight that: two headers, two footers, and a
 * photograph panel the mobile design has no room for.
 *
 * Kept as a file rather than deleted because the route group `(auth)` is what
 * gives `/login` and `/signup` their shared URL shape, and because auth screens
 * will want a shared `loading.tsx` and `error.tsx` here shortly.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return children;
}
