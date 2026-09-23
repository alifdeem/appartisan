"use client";

import * as React from "react";
import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";

import { reverseGeocodeAction, searchAddressAction } from "@/app/(app)/client/geocode-actions";
import { PanelField, PanelInput, panelControlClasses } from "@/components/mobile/panel-field";
import { LocationMap } from "@/components/jobs/location-map";
import { isValidGhanaPostCode, isWithinGhana, type LatLng } from "@/lib/integrations/maps/types";
import { cn } from "@/lib/utils";

/**
 * Where the job is.
 *
 * The hierarchy here is deliberate and is the main reason this screen is not
 * just a search box. PLAN.md §3 makes the point: OpenStreetMap's coverage of
 * Accra is patchier than Google's, so address *search* is the weakest part of
 * the free stack. It is therefore the assistive control, not the primary one.
 *
 * What actually identifies the place, in order of how much Ghanaians rely on
 * each in practice:
 *
 *   1. **The pin.** Always correct, never depends on a gazetteer, and is the
 *      only input the matcher reads. PostGIS measures from this and nothing
 *      else, so matching quality is identical under OSM and Google.
 *   2. **The landmark.** "Blue gate opposite Melcom" is how directions are
 *      actually given here, and it is what the artisan will read on arrival.
 *   3. **The GhanaPostGPS code.** Precise, official, and increasingly known.
 *   4. **The search box and reverse-geocoded label** — a convenience for
 *      getting the map near the right place, and a human-readable caption.
 *      Never load-bearing.
 *
 * Losing address search entirely would make this slower to use. It would not
 * make it unable to describe a location.
 */

const REVERSE_GEOCODE_DEBOUNCE_MS = 700;
const SEARCH_DEBOUNCE_MS = 450;

export interface LocationPickerProps {
  initialPoint: LatLng | null;
  initialAddress: string | null;
  initialLandmark: string | null;
  initialGhanaPost: string | null;
  fieldErrors?: Record<string, string>;
}

interface SearchHit {
  label: string;
  lat: number;
  lng: number;
}

export function LocationPicker({
  initialPoint,
  initialAddress,
  initialLandmark,
  initialGhanaPost,
  fieldErrors,
}: LocationPickerProps) {
  const [point, setPoint] = React.useState<LatLng | null>(initialPoint);
  const [address, setAddress] = React.useState(initialAddress ?? "");
  const [ghanaPost, setGhanaPost] = React.useState(initialGhanaPost ?? "");
  const [landmark, setLandmark] = React.useState(initialLandmark ?? "");

  const [query, setQuery] = React.useState("");
  /**
   * Results carry the query they answer.
   *
   * Clearing them from an effect when the box empties is the obvious version
   * and is a cascading render — React commits the old list, then blanks it.
   * Tagging instead means "are these results current?" is answered during
   * render, and a late reply to an abandoned query can never be shown.
   */
  const [hits, setHits] = React.useState<{ query: string; items: SearchHit[] }>({
    query: "",
    items: [],
  });
  const [searching, setSearching] = React.useState(false);
  const [resolving, setResolving] = React.useState(false);
  const [locating, setLocating] = React.useState(false);

  /**
   * Set when the user picks a search result or their own GPS fix, so the
   * reverse-geocode effect below leaves the label it was handed alone instead
   * of immediately replacing it with Nominatim's rendering of the same place.
   */
  const addressIsAuthored = React.useRef(Boolean(initialAddress));

  // --- address search ----------------------------------------------------
  React.useEffect(() => {
    const trimmed = query.trim();
    // Two characters matches half of Accra; below the threshold there is
    // nothing to do and, deliberately, nothing to unset.
    if (trimmed.length < 3) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchAddressAction(trimmed);
        if (cancelled) return;
        setHits({
          query: trimmed,
          items: results.map((r) => ({ label: r.label, lat: r.lat, lng: r.lng })),
        });
      } catch {
        if (!cancelled) setHits({ query: trimmed, items: [] });
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  /** Only ever shows results that answer what is currently in the box. */
  const visibleHits = query.trim().length >= 3 && hits.query === query.trim() ? hits.items : [];

  // --- reverse geocode once the pin settles ------------------------------
  React.useEffect(() => {
    if (!point) return;
    if (addressIsAuthored.current) {
      // Consume the flag: the next pin move is the user's own, and should
      // refresh the caption.
      addressIsAuthored.current = false;
      return;
    }

    setResolving(true);
    const timer = setTimeout(async () => {
      try {
        const result = await reverseGeocodeAction(point.lat, point.lng);
        // An empty result is normal in OSM's thinner Ghanaian coverage. The pin
        // is still perfectly valid, so this fails quietly rather than shouting.
        if (result?.label) setAddress(result.label);
      } finally {
        setResolving(false);
      }
    }, REVERSE_GEOCODE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      setResolving(false);
    };
  }, [point]);

  const choose = (hit: SearchHit) => {
    addressIsAuthored.current = true;
    setAddress(hit.label);
    setPoint({ lat: hit.lat, lng: hit.lng });
    // Emptying the box is enough — `visibleHits` is derived from it.
    setQuery("");
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error("This browser cannot share your location. Pin it on the map instead.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        // A VPN or a desktop browser guessing from an IP address can land this
        // anywhere. Refuse it rather than silently pinning Frankfurt.
        if (!isWithinGhana(next)) {
          toast.error("That location is outside Ghana. Pin the job on the map instead.");
          return;
        }

        setPoint(next);
        toast.success("Pinned to your current location.");
      },
      (error) => {
        setLocating(false);
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was refused. Pin it on the map instead."
            : "Could not get your location. Pin it on the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const ghanaPostValid = ghanaPost.trim() === "" || isValidGhanaPostCode(ghanaPost);

  return (
    <div className="space-y-5">
      {/* The form reads these; everything above is how they get filled in. */}
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lng" value={point?.lng ?? ""} />
      <input type="hidden" name="addressText" value={address} />

      <div className="relative">
        {searching ? (
          <Loader2
            className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 animate-spin text-copy-muted"
            aria-hidden
          />
        ) : (
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-copy-muted"
            aria-hidden
          />
        )}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for an area — Osu, Spintex, Tema Community 5…"
          aria-label="Search for an address"
          autoComplete="off"
          className={panelControlClasses(false, "pl-11 [&::-webkit-search-cancel-button]:hidden")}
        />

        {visibleHits.length > 0 && (
          <ul className="animate-fade-in absolute inset-x-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto rounded-[1.25rem] border border-hairline bg-white py-1 shadow-[var(--shadow-sheet)]">
            {visibleHits.map((hit) => (
              <li key={`${hit.lat},${hit.lng}`}>
                <button
                  type="button"
                  onClick={() => choose(hit)}
                  className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors duration-[var(--duration-instant)] hover:bg-azure-50"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-azure-500" aria-hidden />
                  <span className="text-note leading-snug text-navy-900">{hit.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative">
        <LocationMap
          value={point}
          onChange={setPoint}
          className="h-72 w-full overflow-hidden rounded-[1.25rem] sm:h-80"
        />

        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className={cn(
            "absolute bottom-3 left-3 z-10 inline-flex min-h-11 items-center gap-2 rounded-full",
            "border border-white/80 bg-white/90 px-4 text-note font-semibold text-navy-900 shadow-[var(--shadow-float)] backdrop-blur",
            "transition-colors duration-[var(--duration-instant)] hover:bg-white active:scale-[0.97]",
            "disabled:opacity-60",
          )}
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Crosshair className="size-4" aria-hidden />
          )}
          Use my location
        </button>
      </div>

      {fieldErrors?.pin && (
        <p role="alert" className="animate-fade-in text-note text-danger-600">
          {fieldErrors.pin}
        </p>
      )}

      <div
        className={cn(
          "flex items-start gap-2.5 rounded-[1.25rem] border border-hairline bg-azure-50/60 px-4 py-3.5",
          !point && "border-dashed",
        )}
      >
        <MapPin className="mt-0.5 size-4 shrink-0 text-azure-500" aria-hidden />
        <div className="min-w-0 flex-1 space-y-0.5">
          {point ? (
            <>
              <p className="text-note leading-snug text-navy-900">
                {resolving && !address ? (
                  <span className="text-copy-muted">Working out the address…</span>
                ) : (
                  address || <span className="text-copy-muted">Unnamed location</span>
                )}
              </p>
              <p className="tabular font-mono text-2xs text-copy-muted">
                {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
              </p>
            </>
          ) : (
            <p className="text-note leading-relaxed text-copy-muted">
              Move the map so the pin sits on the building, then add a landmark below.
            </p>
          )}
        </div>
        {address && point && (
          <button
            type="button"
            onClick={() => setAddress("")}
            title="Clear the address caption"
            className="grid size-7 shrink-0 place-items-center rounded-full text-copy-muted transition-colors hover:bg-white hover:text-navy-900"
          >
            <X className="size-3.5" aria-hidden />
            <span className="sr-only">Clear address</span>
          </button>
        )}
      </div>

      {/*
        Required in earnest since migration 0009. It was drawn with a required
        marker from the start and enforced nowhere, which meant a job could go
        out with an OSM road name as its only human direction — and in Accra a
        road name is frequently four unmarked gates. The pin gets an artisan to
        the street; this gets them to the door.
      */}
      <PanelField
        label="Landmark"
        htmlFor="landmark"
        hint="How you would describe it on the phone — “blue gate opposite Melcom, first house after the junction”."
        error={fieldErrors?.landmark}
      >
        <PanelInput
          id="landmark"
          name="landmark"
          value={landmark}
          onChange={(event) => setLandmark(event.target.value)}
          maxLength={200}
          required
          aria-required
          placeholder="Blue gate opposite Melcom"
          invalid={Boolean(fieldErrors?.landmark)}
        />
      </PanelField>

      <PanelField
        label="GhanaPostGPS code"
        htmlFor="ghanapostCode"
        optional
        hint="If you know it. Example: GA-543-0125."
        error={
          fieldErrors?.ghanapostCode ??
          (ghanaPostValid ? undefined : "Format is two letters, then 3–4 digits, then 4 digits.")
        }
      >
        <PanelInput
          id="ghanapostCode"
          name="ghanapostCode"
          value={ghanaPost}
          onChange={(event) => setGhanaPost(event.target.value.toUpperCase())}
          maxLength={20}
          placeholder="GA-543-0125"
          autoCapitalize="characters"
          spellCheck={false}
          className="tabular font-mono"
          invalid={!ghanaPostValid || Boolean(fieldErrors?.ghanapostCode)}
        />
      </PanelField>
    </div>
  );
}
