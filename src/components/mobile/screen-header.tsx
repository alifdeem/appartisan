import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The top bar: back on the left, an optional centred title, an optional action
 * on the right.
 *
 * The reference uses two forms of this — bare (back + "Skip") on the onboarding
 * screens, and titled (back + centred "Sign Up") on the form screens. One
 * component covers both so the back button never drifts by two pixels between
 * screens.
 *
 * The title is centred with absolute positioning rather than `justify-between`
 * plus a spacer, because a centred title must be centred on the *screen* — not
 * in whatever space the two side slots happen to leave. With a long title and a
 * "Skip" on the right, the flex version drifts visibly off-centre.
 *
 * `size-11` on the back control: the audit measured a 32px logo link and flagged
 * it, and a back button is the single most-tapped control in the app.
 *
 * **The title is a `<p>`, not an `<h1>`.** It is nav chrome — the same role a
 * browser tab label plays — and the screen's real heading lives in the content
 * below it. When it was an h1 the provider signup carried two: "Sign up" in the
 * bar and "Create your account" over the fields. Screen readers announce the
 * document outline, and two h1s make a screen look like two documents.
 */
export function ScreenHeader({
  back,
  title,
  action,
  className,
}: {
  /** Where back goes. Omit for a root screen with no history. */
  back?: string;
  title?: string;
  /** Top-right slot — "Skip", "Done", a help link. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative flex h-14 shrink-0 items-center px-3", className)}>
      {back ? (
        <Link
          href={back}
          aria-label="Go back"
          className="-ml-1 grid size-11 place-items-center rounded-full text-navy-900 transition-colors duration-[var(--duration-instant)] hover:bg-azure-50 active:bg-hairline"
        >
          <ArrowLeft className="size-5" />
        </Link>
      ) : (
        <span className="size-11" aria-hidden />
      )}

      {title && (
        <p className="pointer-events-none absolute inset-x-0 text-center text-lede font-semibold text-navy-900">
          {title}
        </p>
      )}

      {action && <div className="relative z-10 ml-auto pr-1">{action}</div>}
    </header>
  );
}
