import * as React from "react";
import { AlertTriangle, Ban, SearchX } from "lucide-react";

import { JobProgress } from "@/components/jobs/job-progress";
import { LIVE_SURFACE, LIVE_SURFACE_GLOW } from "@/components/jobs/live-surface";
import { CLIENT_MILESTONES, jobStatus, milestoneIndex } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/supabase/types";

/**
 * The top of a job screen: what is happening, and how far along it is.
 *
 * This replaces the old arrangement — a bordered card holding a grey progress
 * rail and a paragraph — and the reason it is one object rather than two is
 * that they were always answering the same question in two voices. "Artisan on
 * the way" and a rail three-fifths filled are the same fact; separating them
 * made the reader assemble it.
 *
 * **The blurb is passed in, not read from the status.** Each state has two
 * voices in `status.ts` — `blurb` speaks to the client, `providerBlurb` to the
 * artisan — and this hero serves both screens. Taking it as a prop is what lets
 * one component sit under "Your artisan is travelling to you" on one screen and
 * "You're on the way. Mark arrived when you get there." on the other, without
 * either screen paraphrasing and drifting out of step with the machine.
 *
 * **Off the happy path it stops being a hero.** Cancelled, disputed and
 * no-match have no position on a five-step rail, and a navy banner celebrating
 * a cancelled job is the kind of thing that makes people stop trusting a
 * product. Those states get a plain, honest panel in the tone of what happened.
 */
export function JobStatusHero({
  status,
  blurb,
  footer,
  children,
}: {
  status: JobStatus;
  /** `blurb` for a client, `providerBlurb` for an artisan. */
  blurb: string;
  /** A strip across the bottom of the hero — who is coming, or what to do. */
  footer?: React.ReactNode;
  /** Sits under the rail, inside the hero. The matching search goes here. */
  children?: React.ReactNode;
}) {
  const presentation = jobStatus(status);
  const current = milestoneIndex(status);

  if (current < 0) return <OffPathPanel status={status} blurb={blurb} />;

  // `paid` and `closed` are finished. The rail is full and nothing is moving,
  // so the pulsing "LIVE" dot would be claiming something that is over.
  const running = presentation.group === "active" && status !== "paid";

  return (
    <section
      className={cn("relative isolate overflow-hidden rounded-[1.75rem] p-5", LIVE_SURFACE)}
    >
      <span aria-hidden className={LIVE_SURFACE_GLOW} />

      <p className="flex items-center gap-2 text-2xs font-bold tracking-[0.08em] text-white uppercase">
        {running && (
          <span className="relative flex size-2.5 shrink-0" aria-hidden>
            {/* `success-500`. The ramp is 50/500/600/700 — `success-300` does
                not exist and renders as nothing, which is how this dot once
                shipped unlit. */}
            <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-success-500" />
            <span className="relative inline-flex size-2.5 rounded-full bg-success-500" />
          </span>
        )}
        {running ? `Live · ${presentation.label}` : presentation.label}
      </p>

      <p className="mt-2.5 font-space text-title-sm leading-tight font-bold text-balance text-white">
        {blurb}
      </p>

      <JobProgress status={status} on="dark" className="mt-6" />

      <p className="mt-3 text-center text-2xs font-medium text-white/85">
        Step <span className="tabular font-mono">{current + 1}</span> of{" "}
        <span className="tabular font-mono">{CLIENT_MILESTONES.length}</span>
      </p>

      {children && <div className="mt-5 border-t border-white/25 pt-5">{children}</div>}
      {footer && <div className="mt-5 border-t border-white/25 pt-4">{footer}</div>}
    </section>
  );
}

/**
 * Cancelled, disputed, or nobody took it.
 *
 * Deliberately not navy and deliberately not red-all-over. These are three
 * quite different endings — one the reader chose, one they raised, one that
 * happened to them — and the icon and tint carry that distinction while the
 * sentence from `status.ts` does the explaining.
 */
const OFF_PATH: Partial<
  Record<JobStatus, { icon: typeof Ban; ring: string; tint: string; text: string }>
> = {
  cancelled_by_client: {
    icon: Ban,
    ring: "border-hairline",
    tint: "bg-canvas text-copy-muted",
    text: "text-navy-900",
  },
  cancelled_by_provider: {
    icon: Ban,
    ring: "border-hairline",
    tint: "bg-canvas text-copy-muted",
    text: "text-navy-900",
  },
  expired_no_match: {
    icon: SearchX,
    ring: "border-warning-500/30",
    tint: "bg-warning-50 text-warning-700",
    text: "text-navy-900",
  },
  disputed: {
    icon: AlertTriangle,
    ring: "border-danger-500/30",
    tint: "bg-danger-50 text-danger-700",
    text: "text-danger-700",
  },
};

function OffPathPanel({ status, blurb }: { status: JobStatus; blurb: string }) {
  const presentation = jobStatus(status);
  const look = OFF_PATH[status] ?? {
    icon: Ban,
    ring: "border-hairline",
    tint: "bg-canvas text-copy-muted",
    text: "text-navy-900",
  };
  const Icon = look.icon;

  return (
    <section className={cn("flex items-start gap-3.5 rounded-[1.5rem] border p-5", look.ring)}>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", look.tint)}>
        <Icon className="size-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn("font-space text-lede font-bold", look.text)}>{presentation.label}</p>
        <p className="mt-1 text-note leading-relaxed text-copy-muted">{blurb}</p>
      </div>
    </section>
  );
}
