import { BadgeCheck, Phone, Star } from "lucide-react";

import { formatPhoneForDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";

/**
 * The other person on this job, and a button that phones them.
 *
 * **The call button is the point of this component**, and it took a policy
 * nobody had used to make it possible. `0003_rls.sql:74` — *"Counterparties on
 * a shared job can see each other's name and phone. Without this the client
 * cannot call the artisan who is on the way to their house."* That policy has
 * been in the schema since the first RLS migration and, until now, nothing read
 * it: neither job screen had a phone number on it.
 *
 * It matters more here than it would in most markets. There is no in-app
 * messaging (PLAN.md §14) and no live tracking, addresses in Accra are
 * landmarks rather than street numbers, and the thing that actually happens
 * when an artisan cannot find a blue gate is a phone call. Making the reader
 * hunt for a number they are entitled to, while somebody waits outside, is a
 * design failure with a real cost.
 *
 * **`tel:` rather than a dialogue.** It hands off to the phone's own dialler,
 * which is the one piece of software in this flow that every user already knows
 * how to operate, and it works with no JavaScript at all.
 *
 * **Two grounds again.** `dark` sits in the navy status hero on the client's
 * screen, where the artisan strip belongs with the live state. `light` is a
 * standalone panel, which is what the artisan's screen needs — their
 * counterparty is not part of the status, it is a person to call when the gate
 * is locked.
 */
export function CounterpartyCard({
  name,
  phone,
  role,
  rating,
  jobsCompleted,
  on = "light",
  /**
   * Shown in place of a rating for someone with neither. `provider_public` only
   * ever returns approved, unsuspended artisans, so on an artisan this is not a
   * consolation prize — it is the strongest true thing about them on day one.
   */
  verified = false,
}: {
  name: string;
  phone: string;
  /** "Plumber", "Customer" — what they are on *this* job. */
  role: string;
  /** Only once it means something: three reviews minimum. */
  rating?: { average: number; count: number } | null;
  jobsCompleted?: number;
  on?: "light" | "dark";
  verified?: boolean;
}) {
  const dark = on === "dark";
  const rated = rating !== null && rating !== undefined && rating.count >= 3;

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        !dark && "rounded-[1.25rem] border border-hairline bg-white p-4",
      )}
    >
      {/* Initials, not a photograph. There is no avatar upload in this product,
          so a stock silhouette would be a placeholder for a feature that does
          not exist. */}
      <span
        aria-hidden
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full font-space text-ui font-bold",
          dark ? "bg-white text-azure-700" : "bg-navy-800 text-white",
        )}
      >
        {initials(name)}
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-ui font-bold", dark ? "text-white" : "text-navy-900")}>
          {name}
        </p>
        <p
          className={cn(
            "mt-0.5 flex flex-wrap items-center gap-x-1.5 text-2xs",
            dark ? "text-white/85" : "text-copy-muted",
          )}
        >
          <span className="truncate">{role}</span>

          {rated && (
            <>
              <span aria-hidden>·</span>
              <span className="tabular inline-flex items-center gap-0.5 font-mono">
                {rating.average.toFixed(1)}
                <Star className="size-3 fill-current" aria-hidden />
              </span>
            </>
          )}

          {jobsCompleted !== undefined && jobsCompleted > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="tabular font-mono">{jobsCompleted} jobs</span>
            </>
          )}

          {!rated && verified && !jobsCompleted && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 font-medium">
                <BadgeCheck className="size-3.5" aria-hidden />
                Verified
              </span>
            </>
          )}
        </p>
      </div>

      {/* 48px and circular. This is tapped one-handed, often in a hurry, and
          frequently by somebody already holding something in the other hand. */}
      <a
        href={`tel:${phone}`}
        aria-label={`Call ${name} on ${formatPhoneForDisplay(phone)}`}
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full",
          "transition-[background-color,transform] duration-[var(--duration-instant)] ease-out-strong",
          "active:scale-[0.94]",
          dark
            ? "bg-white text-azure-700 hover:bg-azure-50"
            : "bg-linear-to-b from-navy-800 to-navy-900 text-white shadow-[var(--shadow-glow-navy)]",
        )}
      >
        <Phone className="size-5" aria-hidden />
      </a>
    </div>
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
