"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetch a live job when the reader comes back to it.
 *
 * The case this exists for is not a browser tab. It is an artisan who taps
 * "I'm setting out", locks their phone, drives across Accra, and unlocks it
 * again — or a client who checks on their job, takes a call, and comes back.
 * A mobile browser freezes the page rather than reloading it, so the screen
 * they return to is the screen they left, which on a job that has moved on is
 * simply wrong. Nothing in the app asked for fresh data at that moment.
 *
 * Three signals, because no one of them covers it:
 *
 *  • **`visibilitychange`** — the app was backgrounded and brought back. The
 *    common one on a phone. Only fires a refresh if the page was actually
 *    hidden, so a notification shade or a permission prompt does not thrash it.
 *  • **`pageshow` with `persisted`** — a true back/forward-cache restore, where
 *    the browser hands back the whole frozen document.
 *  • **`online`** — the connection came back. Anything that failed while it was
 *    down left the screen stale by definition.
 *
 * **Only mounted for jobs that can still change.** A finished job is a record;
 * refreshing it on every glance spends somebody's mobile data to re-fetch a
 * screen that is identical. `router.refresh()` re-requests the server
 * component tree and reconciles in place — no flash, no lost scroll position,
 * no client state thrown away.
 */
export function RefreshOnReturn() {
  const router = useRouter();

  React.useEffect(() => {
    let wasHidden = document.visibilityState === "hidden";

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
        return;
      }
      if (!wasHidden) return;
      wasHidden = false;
      router.refresh();
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) router.refresh();
    }

    function onOnline() {
      router.refresh();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  return null;
}
