"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Hammer, House } from "lucide-react";

import { FieldLabel } from "@/components/mobile/field-label";
import { OptionCard } from "@/components/mobile/option-card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * "I want to" — the choice that splits the two products, as the reference's
 * selectable cards.
 *
 * **Why this replaced two link-buttons.** The previous screen made each option
 * its own `<Link>`, so choosing *was* navigating. The mockup separates them: you
 * pick, you see the pick confirmed, and then you commit. That is the better
 * shape for this particular question, because it is the one decision on the
 * screen that is annoying to undo — a client account and an artisan account
 * lead to entirely different apps — and a choice worth confirming deserves a
 * beat before it is acted on.
 *
 * **Why real radios.** Two `<button>`s where exactly one may be chosen is a
 * radio group in costume: a screen reader announces two unrelated buttons with
 * no sense that they are alternatives or which one is current, and the arrow
 * keys do nothing. A `<fieldset>` of two radios gets the grouping, the
 * announcement, the arrow-key roving focus and the "2 of 2" position for free.
 * The inputs are `sr-only`; the card carries their focus ring through
 * `has-[:focus-visible]`.
 *
 * **Why the CTA is a `<Link>` and not a submit.** The obvious no-JavaScript
 * version is a GET form posting to `/signup`, which would work without this
 * file existing — but it costs a full document navigation on the one tap that
 * should feel instant. A `<Link>` whose href tracks the selection soft-navigates
 * and prefetches. The routing contract is unchanged either way: the next screen
 * is still `/signup?role=client|provider`, still in `PUBLIC_PATHS`, still
 * parsed by the same `parseRole`.
 */
type Role = "client" | "provider";

/**
 * The reference's own subtitles, with one word changed and one comma saved.
 *
 * "professionals" → "artisans": the platform's word for the people on it is
 * artisan, everywhere, and the role card is the first place a new user meets
 * it. Using the generic word here and the specific one on every screen after it
 * teaches the wrong vocabulary at exactly the moment someone is learning it.
 *
 * Both lines are also cut to fit on one line at 360px. A subtitle that wraps to
 * two on the narrow phones half this audience is holding makes the two cards
 * different heights, which is visible and reads as a bug.
 */
const OPTIONS = [
  {
    value: "client",
    icon: <House />,
    title: "Book a service",
    subtitle: "Find skilled artisans near you.",
  },
  {
    value: "provider",
    icon: <Hammer />,
    title: "Work as an artisan",
    subtitle: "Showcase your skills, get hired.",
  },
] as const;

export function RolePicker({ children }: { children?: React.ReactNode }) {
  const [role, setRole] = React.useState<Role>("client");

  return (
    <div>
      <fieldset>
        <FieldLabel as="legend">I want to</FieldLabel>

        <div className="mt-3 space-y-3">
          {OPTIONS.map((option) => (
            <label key={option.value} className="block cursor-pointer">
              <OptionCard
                selected={role === option.value}
                icon={option.icon}
                title={option.title}
                subtitle={option.subtitle}
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                  className="sr-only"
                />
              </OptionCard>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="mt-5 text-ui text-copy-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="tap inline-flex items-center gap-1.5 font-semibold text-navy-900 hover:text-azure-600"
        >
          Log in
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </p>

      {/* Everything between the choice and the commitment — the trust panel and
          the three promises — is composed in from the page as children rather
          than built here. They are static server-rendered content with no need
          of the selection, and passing them through as `children` keeps them out
          of the client bundle instead of dragging two more components across the
          boundary just because they sit in the middle of the stack. */}
      {children}

      {/* The CTA lives here, below the promises, because it needs to read the
          selection. Two literal hrefs rather than a template literal: typed
          routes checks the string, and an interpolated one is only ever as safe
          as the variable in it. */}
      <Link
        href={role === "provider" ? "/signup?role=provider" : "/signup?role=client"}
        className={cn(
          buttonVariants({ variant: "navy", size: "lg", shape: "pill", block: true }),
          "mt-8",
        )}
      >
        Create account
        <ArrowRight />
      </Link>
    </div>
  );
}
