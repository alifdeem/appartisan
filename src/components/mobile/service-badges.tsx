import { Brush, Ellipsis, PaintRoller, Wrench } from "lucide-react";

/**
 * The four service circles under the login headline.
 *
 * **They are not links, and that is deliberate.** The mockup draws them as
 * tappable chips, but there is nowhere for them to go: browsing artisans
 * requires a session (`src/proxy.ts`), so a tap would land on the login screen
 * the user is already looking at. A control that looks pressable and answers
 * with nothing is worse than a label — it teaches people the app is broken
 * before they have an account.
 *
 * So they read as evidence rather than navigation: this is the kind of work
 * that happens here. `<ul>` with plain text, no `role`, no `tabindex`, nothing
 * in the tab order between the headline and the form.
 *
 * The "glass" is three layers, not a blur: a white fill at 70%, a white
 * hairline, and a soft blue-tinted shadow. `backdrop-filter` was the obvious
 * route and is the wrong one here — this audience is on low-end Android
 * outdoors, where a backdrop blur is the most expensive thing on the screen,
 * and it buys almost nothing over a pale wash on a pale ground.
 */
const SERVICES = [
  { icon: Wrench, label: "Home\nServices" },
  { icon: PaintRoller, label: "Repairs &\nMaintenance" },
  { icon: Brush, label: "Cleaning\nServices" },
  { icon: Ellipsis, label: "And\nMore" },
] as const;

export function ServiceBadges() {
  return (
    <ul className="flex items-start gap-3">
      {SERVICES.map(({ icon: Icon, label }) => (
        <li key={label} className="flex w-16 flex-col items-center gap-2 text-center">
          <span
            aria-hidden
            className="grid size-12 place-items-center rounded-full border border-white/70 bg-white/70 text-navy-800 shadow-[var(--shadow-float)] [&_svg]:size-5"
          >
            <Icon strokeWidth={2} />
          </span>
          {/* `whitespace-pre-line` renders the authored line break, so "Repairs &
              Maintenance" always breaks after the ampersand instead of wherever
              the box happens to run out — which at 360px is mid-word. */}
          <span className="text-2xs leading-[1.35] whitespace-pre-line text-copy-muted">
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
