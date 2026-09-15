import "server-only";

import { env } from "@/lib/env";
import {
  GHANA_BOUNDS,
  type GeocodeResult,
  type LatLng,
  type MapProvider,
} from "./types";

/**
 * OpenStreetMap geocoding via Nominatim. Free, no key.
 *
 * Nominatim's usage policy requires an identifying User-Agent and caps requests
 * at roughly one per second. Calls must therefore be server-side only, and the
 * location picker is designed so that a client can complete a job without ever
 * hitting this — pin, landmark and GhanaPostGPS code carry the address.
 *
 * Coverage in Ghana is patchier than Google's. That is a known and accepted
 * trade for v1 costing nothing (PLAN.md §3).
 */

const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "ArtisanGH/0.1 (https://artisangh.app)";

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  importance?: number;
  address?: Record<string, string>;
}

function toResult(place: NominatimPlace): GeocodeResult {
  const address = place.address ?? {};
  return {
    lat: Number.parseFloat(place.lat),
    lng: Number.parseFloat(place.lon),
    label: place.display_name,
    city:
      address.city ?? address.town ?? address.suburb ?? address.municipality ?? address.state,
    confidence: place.importance,
  };
}

export class OsmMapProvider implements MapProvider {
  readonly name = "osm";

  async geocode(query: string): Promise<GeocodeResult[]> {
    const url = new URL(`${NOMINATIM}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");
    url.searchParams.set("countrycodes", "gh");
    url.searchParams.set(
      "viewbox",
      `${GHANA_BOUNDS.minLng},${GHANA_BOUNDS.maxLat},${GHANA_BOUNDS.maxLng},${GHANA_BOUNDS.minLat}`,
    );

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
        // Addresses are stable; caching keeps us well inside the usage policy.
        next: { revalidate: 60 * 60 * 24 },
      });

      if (!response.ok) return [];

      const places = (await response.json()) as NominatimPlace[];
      return places.map(toResult);
    } catch (error) {
      console.error("[maps:osm] geocode failed", error);
      return [];
    }
  }

  async reverseGeocode(point: LatLng): Promise<GeocodeResult | null> {
    const url = new URL(`${NOMINATIM}/reverse`);
    url.searchParams.set("lat", String(point.lat));
    url.searchParams.set("lon", String(point.lng));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
        next: { revalidate: 60 * 60 * 24 },
      });

      if (!response.ok) return null;

      const place = (await response.json()) as NominatimPlace & { error?: string };
      if (place.error) return null;

      return toResult(place);
    } catch (error) {
      console.error("[maps:osm] reverse geocode failed", error);
      return null;
    }
  }
}

/**
 * Tile layer config for Leaflet. Defined in `./types` — which carries no
 * `server-only` import — because the map component that needs it is a Client
 * Component and this module can never be bundled for the browser.
 */
export { OSM_TILE_LAYER } from "./types";

export const mapProviderName = env.MAP_PROVIDER;
