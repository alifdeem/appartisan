import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Star } from "lucide-react";

import { LIVE_SURFACE, LIVE_SURFACE_GLOW } from "@/components/jobs/live-surface";
import { CLIENT_MILESTONES, milestoneIndex } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/supabase/types";

/**
 * The live job, as the first thing on a dashboard.
 *
 * One card, both sides: the client sees who is coming, the artisan sees what to
 * do next. Same shell, because a live job is the same object from either end
 * and two near-identical components drift.
 *
 * **What the reference draws that is not here, and why.** The mockup carries a
 * route line and "8 min away". Neither exists: `set_provider_location` and
 * `record_location_ping` have been in the schema since migration 0005 —
 * commented "used by the client's live tracking map in Phase 5" — and **nothing
 * has ever called them**, so no artisan position is recorded anywhere and no
 * ETA is computed. An invented "8 min away" on the one card whose whole job is
 * to reassure somebody that a stranger is coming to their house is the worst
 * possible thing to get wrong.
 *
 * So the space the map occupied carries **the milestone rail**, enlarged. It
 * answers the same question — *where have we got to* — and it is the one thing
 * on the card that genuinely moves as the job does. Live tracking can take the
 * space back the day something writes those pings.
 */
export function LiveJobCard({
  href,
  eyebrow,
  title,
  subtitle,
  status,
  person,
  action,
  titleAs: Title = "h2",
}: {
  href: string;
  /** "Artisan on the way", "Work in progress" — the state, in the reader's terms. */
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  status: JobStatus;
  /** The other party. The client sees their artisan; the artisan sees nobody. */
  person?: {
    name: string;
    trade: string;
    ratingAvg: number;
    ratingCount: number;
    jobsCompleted: number;
  } | null;
  /** What the reader does next. Used on the artisan side in place of `person`. */
  action?: string | null;
  /**
   * The card's heading level.
   *
   * `h2` by default because on both dashboards this card is a top-level
   * section sitting directly under the page's `h1`. It was `h3`, which skipped
   * a level and failed `npm run a11y` on two screens at once — screen readers
   * announce the outline, and a jump from h1 to h3 implies a section that is
   * not there. A page that nests it deeper can pass `h3`.
   */
  titleAs?: "h2" | "h3";
}) {
  const current = milestoneIndex(status);
  // Off the happy path — cancelled, disputed, no match. A half-filled rail on a
  // cancelled job reads as a system that has not noticed.
  if (current < 0) return null;

  const milestone = CLIENT_MILESTONES[current];
  const rated = person ? person.ratingCount >= 3 : false;

  return (
    <Link
      href={href}
      className={cn(
        "group relative isolate block overflow-hidden rounded-[1.75rem] p-5",
        LIVE_SURFACE,
        "transition-transform duration-[var(--duration-fast)] ease-out-strong",
        "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]",
      )}
    >
      {/* Internal lighting, the same device the earnings banner uses: a flat
          fill reads as a block of colour rather than a surface. */}
      <span aria-hidden className={LIVE_SURFACE_GLOW} />

      <p className="flex items-center gap-2 text-2xs font-bold tracking-[0.08em] text-white uppercase">
        <span className="relative flex size-2.5 shrink-0">
          {/* `success-500`, not `success-300`: the ramp in globals.css is
              50/500/600/700, so `success-300` resolved to nothing and the dot
              rendered invisible — a status light that was not lit. */}
          <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-success-500" />
          <span className="relative inline-flex size-2.5 rounded-full bg-success-500" />
        </span>
        Live · {eyebrow}
      </p>

      <Title className="mt-2.5 font-space text-title-sm leading-tight font-bold text-balance text-white">
        {title}
      </Title>
      {subtitle && <p className="mt-1 text-note text-white/85">{subtitle}</p>}

      {/* ---- The milestone rail, where the reference puts its map ---------- */}
      <ol className="mt-5 flex items-center gap-1.5" aria-label="Progress">
        {CLIENT_MILESTONES.map((step, index) => (
          <li
            key={step.key}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-[var(--duration-base)]",
              index <= current ? "bg-white" : "bg-white/30",
            )}
          />
        ))}
      </ol>
      <p className="mt-2 text-2xs font-medium text-white/85">
        Step {current + 1} of {CLIENT_MILESTONES.length} · {milestone.label}
      </p>

      {/* ---- Who, or what next -------------------------------------------- */}
      {person ? (
        <div className="mt-5 flex items-center gap-3 border-t border-white/25 pt-4">
          {/* Initials, not a photograph. There is no avatar upload in this
              product, so a stock silhouette would be a placeholder for a
              feature that does not exist. */}
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white font-space text-note font-bold text-azure-700"
          >
            {initials(person.name)}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-ui font-bold text-white">{person.name}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-2xs text-white/85">
              <span className="truncate">{person.trade}</span>
              {rated && (
                <>
                  <span aria-hidden>·</span>
                  <span className="tabular inline-flex items-center gap-0.5 font-mono">
                    {person.ratingAvg.toFixed(1)}
                    <Star className="size-3 fill-current" aria-hidden />
                  </span>
                </>
              )}
              {person.jobsCompleted > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="tabular font-mono">{person.jobsCompleted} jobs</span>
                </>
              )}
              {/* A new artisan has no rating and no job count, which left this
                  line reading "Kwame Mensah / Electrical" — thin, on the card
                  whose whole job is reassurance. `provider_public` only ever
                  returns approved, unsuspended artisans, so this is not a
                  consolation prize: it is the strongest true thing about
                  somebody on their first job. */}
              {!rated && person.jobsCompleted === 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Verified
                  </span>
                </>
              )}
            </span>
          </span>

          <ArrowUpRight
            className="size-5 shrink-0 text-white/70 transition-transform duration-[var(--duration-fast)] ease-out-strong group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      ) : (
        action && (
          <div className="mt-5 flex items-center gap-3 border-t border-white/25 pt-4">
            <span className="min-w-0 flex-1 text-note leading-snug font-medium text-white">
              {action}
            </span>
            <ArrowUpRight
              className="size-5 shrink-0 text-white/70 transition-transform duration-[var(--duration-fast)] ease-out-strong group-hover:translate-x-0.5"
              aria-hidden
            />
          </div>
        )
      )}
    </Link>
  );
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}
