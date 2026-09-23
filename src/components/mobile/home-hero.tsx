import Link from "next/link";
import { Bell, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The client home's header — `home.png`, top of screen.
 *
 * **This used to be a hero band and should not have been.** It carried a
 * 28px headline over a gradient with a masked artisan plate, and took roughly
 * 280px before the search bar appeared. The reference spends about 110px on the
 * same job: a greeting, one line saying what the screen is for, a bell, and the
 * location. On a 360px phone that difference is the whole first screenful —
 * everything that matters was below the fold.
 *
 * So: no gradient, no artisan plate, no headline. Greeting and subtitle in the
 * type the reference uses, then straight into the search. The decorative work
 * the gradient was doing is not missed, because the photographs in the featured
 * row are now real and supply the colour.
 */
export function HomeHero({
  greeting,
  subtitle,
  address,
  activeCount,
}: {
  greeting: string;
  subtitle: string;
  /** The client's saved default address, when they have one. */
  address?: string | null;
  /** Jobs currently in flight — drives the bell's badge. */
  activeCount: number;
}) {
  return (
    <header className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-space text-title-sm leading-tight font-bold text-balance text-navy-900">
            {greeting}
          </h1>
          <p className="mt-1 text-note text-copy-muted">{subtitle}</p>
        </div>

        <ActivityBell count={activeCount} />
      </div>

      {address && <LocationLine address={address} />}
    </header>
  );
}

/**
 * The reference's notification bell — wired to something real.
 *
 * ArtisanGH has no notification centre: nothing in the schema stores one, and a
 * bell that opens an empty screen is the dead control this redesign has been
 * deleting everywhere else. What it *does* have is jobs that change state, and
 * a client checking for news is checking for exactly that. So the bell goes to
 * the jobs list and its badge counts what is genuinely in flight — which makes
 * it an accurate indicator rather than a decorative one.
 */
function ActivityBell({ count }: { count: number }) {
  return (
    <Link
      href="/client/jobs"
      aria-label={count > 0 ? `Job updates, ${count} in progress` : "Your jobs"}
      className={cn(
        "relative grid size-11 shrink-0 place-items-center rounded-full bg-azure-50 text-navy-800",
        "transition-[background-color,transform] duration-[var(--duration-instant)] ease-out-strong",
        "hover:bg-azure-100 active:scale-[0.96]",
      )}
    >
      <Bell className="size-5" aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="tabular absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-azure-500 px-1 text-[0.625rem] font-bold text-white ring-2 ring-white"
        >
          {count}
        </span>
      )}
    </Link>
  );
}

/**
 * The saved address, in the reference's blue-with-a-pin treatment.
 *
 * **No chevron, because there is no picker.** The reference's control is a city
 * selector for a marketplace with one location per session. Location in
 * ArtisanGH belongs to the *job*, not the account — every posted job carries its
 * own address and landmark, set in the posting flow. This line shows the
 * default the client last saved, which is a useful reminder and not a control.
 * A chevron would promise a dropdown with nothing to list.
 *
 * Absent entirely until a client has saved one, rather than falling back to a
 * guessed "Accra, Ghana" — a location the app asserts and the client never gave
 * it is worse than no location at all.
 */
function LocationLine({ address }: { address: string }) {
  return (
    <p className="flex items-center gap-1.5 text-note font-semibold text-azure-600">
      <MapPin className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{address}</span>
    </p>
  );
}
