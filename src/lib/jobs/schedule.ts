/**
 * When the client would like the artisan.
 *
 * **A preference, not a booking.** ArtisanGH dispatches on posting — the
 * matcher offers the job to the nearest available artisan straight away. This
 * is what the client would *like*, carried to the artisan in the offer so the
 * two of them can agree the real arrival on the call they already have. See the
 * long note in migration 0023; the schema deliberately does not pretend to be a
 * calendar.
 *
 * The hours attached to each window are presentation and live only here, so
 * changing what "afternoon" means is one edit rather than a search across the
 * client screens, the artisan screens and the offer SMS.
 */

export const PREFERRED_WINDOWS = ["morning", "afternoon", "evening"] as const;

export type PreferredWindow = (typeof PREFERRED_WINDOWS)[number];

export const WINDOW_LABELS: Record<PreferredWindow, { label: string; hours: string }> = {
  morning: { label: "Morning", hours: "8am – 12pm" },
  afternoon: { label: "Afternoon", hours: "12pm – 4pm" },
  evening: { label: "Evening", hours: "4pm – 8pm" },
};

export function isPreferredWindow(value: unknown): value is PreferredWindow {
  return typeof value === "string" && (PREFERRED_WINDOWS as readonly string[]).includes(value);
}

/**
 * `YYYY-MM-DD` for a date, in Ghana's own terms.
 *
 * Ghana is UTC+0 year round with no DST, so the calendar day never disagrees
 * with the UTC day and `toISOString().slice(0, 10)` is correct here. It is
 * still written out rather than left implicit, because a reader in another
 * timezone would be right to be suspicious of it.
 */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The next `count` days starting today.
 *
 * Seven, not a month: this is a service you are trying to get someone out for,
 * and a client picking a date three weeks away is describing something the
 * matcher cannot act on. Beyond a week the honest answer is "post it nearer the
 * time", which the screen says.
 */
export function upcomingDays(count = 7, from = new Date()): { key: string; date: Date }[] {
  const days: { key: string; date: Date }[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(from);
    date.setDate(date.getDate() + i);
    days.push({ key: toDateKey(date), date });
  }
  return days;
}

const DAY_FMT = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const FULL_FMT = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function dayLabel(date: Date, today = new Date()): string {
  if (toDateKey(date) === toDateKey(today)) return "Today";

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (toDateKey(date) === toDateKey(tomorrow)) return "Tomorrow";

  return DAY_FMT.format(date);
}

export function dateLabel(date: Date): string {
  return DATE_FMT.format(date);
}

/**
 * The one-line summary shown on review, on the job and to the artisan.
 *
 * Returns "As soon as possible" rather than an empty string when nothing was
 * chosen, because that is what an unset preference actually means here — the
 * job goes out the moment it is posted either way.
 */
export function scheduleSummary(
  preferredDate: string | null,
  preferredWindow: string | null,
  today = new Date(),
): string {
  if (!preferredDate) return "As soon as possible";

  // `T00:00:00Z` rather than bare `YYYY-MM-DD`: the bare form is parsed as UTC
  // by spec, but appending it is what makes that explicit to the next reader.
  const date = new Date(`${preferredDate}T00:00:00Z`);
  const day =
    dayLabel(date, today) === "Today" || dayLabel(date, today) === "Tomorrow"
      ? dayLabel(date, today)
      : FULL_FMT.format(date);

  if (!isPreferredWindow(preferredWindow)) return `${day}, any time`;
  return `${day}, ${WINDOW_LABELS[preferredWindow].label.toLowerCase()} (${WINDOW_LABELS[preferredWindow].hours})`;
}
