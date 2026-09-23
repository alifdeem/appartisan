"use client";

import "leaflet/dist/leaflet.css";

import * as React from "react";
import { Loader2, Minus, Plus } from "lucide-react";

import { ACCRA_CENTRE, OSM_TILE_LAYER, type LatLng } from "@/lib/integrations/maps/types";
import { cn } from "@/lib/utils";

/**
 * The map behind the location picker.
 *
 * **Centre pin, not a draggable marker.** The pin is a DOM overlay fixed at the
 * centre of the frame and the map moves underneath it. Every ride-hailing app
 * in Ghana works this way and the reason is physical: dragging a 40px marker to
 * a precise point needs two hands and a view of what your thumb is covering.
 * Panning the map needs neither, and the target never leaves the middle of the
 * screen where you are already looking.
 *
 * A consequence worth knowing: the pin is not a Leaflet layer, so it costs
 * nothing to render and never desynchronises from the viewport.
 *
 * Leaflet is loaded with a dynamic `import()` inside an effect rather than at
 * module scope. It touches `window` on evaluation, so a static import would
 * break the server render of any page that contains this component — and this
 * keeps ~40KB out of the bundle for every client who never posts a job.
 */

/** Below this, two positions are the same place and not worth a re-render. */
const EPSILON = 0.000_02;

function samePoint(a: LatLng | null, b: LatLng | null): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.lat - b.lat) < EPSILON && Math.abs(a.lng - b.lng) < EPSILON;
}

export interface LocationMapProps {
  value: LatLng | null;
  /**
   * Optional, and it has to be.
   *
   * Two of the three screens that render this map are read-only previews on
   * **Server** Components — the posting review step and the client's job
   * screen. A required handler forced those pages to pass `onChange={() => {}}`
   * just to satisfy the type, and a function prop crossing the server/client
   * boundary is not a type error, it is a runtime crash: "Event handlers cannot
   * be passed to Client Component props". The build could not catch it because
   * both routes are dynamic and only fail once actually rendered.
   *
   * Making it optional removes the reason to write the no-op at all. It is
   * never invoked when `interactive` is false, so a preview has nothing to say.
   */
  onChange?: (point: LatLng) => void;
  /** Raised while the user is panning, so the parent can hold off geocoding. */
  onMoveStart?: () => void;
  className?: string;
  /** Read-only preview — used on the review and job-detail screens. */
  interactive?: boolean;
}

export function LocationMap({
  value,
  onChange,
  onMoveStart,
  className,
  interactive = true,
}: LocationMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<import("leaflet").Map | null>(null);
  const [ready, setReady] = React.useState(false);
  const [moving, setMoving] = React.useState(false);
  const [wheelEnabled, setWheelEnabled] = React.useState(false);

  /**
   * The latest props, read from inside Leaflet's event handlers.
   *
   * The handlers are registered once for the life of the map; without this they
   * would close over the first render's `onChange` and keep calling it forever.
   */
  const latest = React.useRef({ value, onChange, onMoveStart, interactive });
  React.useEffect(() => {
    latest.current = { value, onChange, onMoveStart, interactive };
  });

  // --- create the map, exactly once -------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    void (async () => {
      const L = (await import("leaflet")).default;

      // The effect can be torn down mid-import — React 19 StrictMode runs
      // effects twice in development, and Leaflet refuses to initialise a
      // container it has already claimed.
      if (cancelled || mapRef.current) return;

      const start = latest.current.value ?? ACCRA_CENTRE;

      const map = L.map(container, {
        center: [start.lat, start.lng],
        zoom: latest.current.value ? 17 : 12,
        zoomControl: false,
        attributionControl: true,
        // Wheel zoom stays off until the user commits to the map by clicking
        // it. A map that swallows the page scroll on the way past is the
        // single most complained-about map behaviour on the web.
        scrollWheelZoom: false,
        dragging: latest.current.interactive,
        touchZoom: latest.current.interactive,
        doubleClickZoom: latest.current.interactive,
        keyboard: latest.current.interactive,
      });

      L.tileLayer(OSM_TILE_LAYER.url, {
        attribution: OSM_TILE_LAYER.attribution,
        maxZoom: OSM_TILE_LAYER.maxZoom,
      }).addTo(map);

      map.on("movestart", () => {
        if (!latest.current.interactive) return;
        setMoving(true);
        latest.current.onMoveStart?.();
      });

      map.on("moveend", () => {
        setMoving(false);
        if (!latest.current.interactive) return;

        const centre = map.getCenter();
        const next = { lat: centre.lat, lng: centre.lng };

        // Only report a genuine change. `setView` below also fires moveend, so
        // without this the map and its parent would ping-pong forever.
        if (!samePoint(next, latest.current.value)) {
          latest.current.onChange?.(next);
        }
      });

      mapRef.current = map;
      setReady(true);

      // Leaflet measures its container on creation. Inside a freshly mounted
      // card that measurement can land before layout settles, which renders a
      // grey strip instead of tiles.
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // --- follow the value when it is changed from outside ------------------
  // Search results and "use my location" set the point without touching the
  // map, so the viewport has to catch up.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;

    const centre = map.getCenter();
    if (samePoint({ lat: centre.lat, lng: centre.lng }, value)) return;

    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 17), {
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  }, [value]);

  const enableWheel = React.useCallback(() => {
    if (!interactive || wheelEnabled) return;
    mapRef.current?.scrollWheelZoom.enable();
    setWheelEnabled(true);
  }, [interactive, wheelEnabled]);

  const zoom = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(map.getZoom() + delta);
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.25rem] border border-hairline bg-azure-50",
        className,
      )}
      onPointerDown={enableWheel}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 z-0"
        // Leaflet's own focus outline is a blue rectangle over the tiles.
        style={{ outline: "none" }}
        role="application"
        aria-label={
          interactive ? "Map. Pan to move the pin to the job location." : "Job location map"
        }
      />

      {!ready && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-azure-50">
          <Loader2 className="size-5 animate-spin text-navy-800/40" aria-hidden />
          <span className="sr-only">Loading map</span>
        </div>
      )}

      {/* The pin. Sits above the tiles, ignores pointer events entirely, and
          never moves — the map moves under it. */}
      {ready && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full"
          aria-hidden
        >
          <div
            className={cn(
              "transition-transform duration-[var(--duration-fast)] ease-out-strong",
              // Lifts off the ground while panning, which reads as "not placed
              // yet" without needing a word of copy.
              moving && interactive && "-translate-y-1.5",
            )}
          >
            <svg width="30" height="40" viewBox="0 0 30 40" fill="none" className="drop-shadow-md">
              <path
                d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 25 15 25s15-14.5 15-25c0-8.284-6.716-15-15-15Z"
                className="fill-navy-800"
              />
              <circle cx="15" cy="15" r="5.5" className="fill-white" />
            </svg>
          </div>

          {/* Contact shadow, so the pin reads as standing on the map rather
              than floating over it. Shrinks as the pin lifts. */}
          <div
            className={cn(
              "mx-auto -mt-1 h-1.5 rounded-[50%] bg-navy-950/25 blur-[2px]",
              "transition-all duration-[var(--duration-fast)] ease-out-strong",
              moving && interactive ? "w-2.5 opacity-40" : "w-4 opacity-70",
            )}
          />
        </div>
      )}

      {ready && interactive && (
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
          <MapButton label="Zoom in" onClick={() => zoom(1)}>
            <Plus className="size-4" aria-hidden />
          </MapButton>
          <MapButton label="Zoom out" onClick={() => zoom(-1)}>
            <Minus className="size-4" aria-hidden />
          </MapButton>
        </div>
      )}
    </div>
  );
}

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "grid size-9 place-items-center rounded-[0.75rem] border border-white/80 bg-white/95 text-navy-900 shadow-[var(--shadow-float)] backdrop-blur",
        "transition-colors duration-[var(--duration-instant)] hover:bg-white active:scale-[0.96]",
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
