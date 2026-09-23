/**
 * The azure surface every "this job is happening" card is drawn on.
 *
 * One definition, imported by `LiveJobCard` on both dashboards and by
 * `JobStatusHero` on both job screens, so tapping the card on a dashboard lands
 * you on a screen headed by the same object. Two hand-copied gradients is how
 * that stops being true after one edit.
 *
 * **Why azure and not navy.** Navy is money in this app — the earnings hero,
 * the deposit panel, the quote total. Azure is *state*: live, moving, happening
 * now. Keeping them apart means a client scrolling their job screen can tell
 * what a card is before reading a word of it, and it stops the status hero and
 * the payment panel below it merging into one blue mass.
 *
 * **Why the tail is `azure-700` and not `azure-500`.** The gradient this came
 * from ran `azure-600 → azure-500`, which put its lightest point at the bottom
 * right — exactly where the person strip and the action strip sit. White on
 * `azure-500` is **3.55:1** and `white/75` on it is **2.67:1**; WCAG AA wants
 * 4.5 for anything that is not large text, and almost everything in the lower
 * half of these cards is 11–13px. Running the gradient the other way keeps the
 * colour the eye reads as "that lighter blue" and puts the contrast headroom
 * where the small text actually is: white on `azure-700` is 6.96:1.
 *
 * Measured, not eyeballed — oklch converted to sRGB and run through the WCAG
 * relative-luminance formula. The numbers are in the redesign context file.
 */
export const LIVE_SURFACE = [
  "bg-linear-to-br from-azure-600 via-azure-600 to-azure-700",
  "shadow-[0_18px_44px_-18px_var(--color-azure-700)]",
].join(" ");

/**
 * The lit corner.
 *
 * A flat fill reads as a block of colour; a highlight falling away from one
 * corner reads as a surface. White rather than a tint of the fill — on azure a
 * lighter azure bloom is invisible.
 */
export const LIVE_SURFACE_GLOW =
  "absolute -top-20 -right-12 -z-10 size-56 rounded-full bg-white/20 blur-3xl";
