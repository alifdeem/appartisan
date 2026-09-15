/**
 * Maps port.
 *
 * v1 renders OpenStreetMap via Leaflet — free, no card, no account. Google Maps
 * swaps in at go-live by changing MAP_PROVIDER.
 *
 * Worth being clear about what this port does NOT do: matching distance. That
 * comes from PostGIS (`find_candidate_providers`), so which artisan gets
 * offered a job is identical under either provider. Only address *search*
 * quality differs — which is why the location picker leans on a dropped pin, a
 * landmark field and a GhanaPostGPS code rather than on text search. That is
 * how Ghanaians give directions anyway. See PLAN.md §3.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult extends LatLng {
  /** Human-readable address as the provider formatted it. */
  label: string;
  /** Best-effort locality, e.g. "Tema", used to pick a transport zone. */
  city?: string;
  confidence?: number;
}

export interface MapProvider {
  readonly name: string;
  /** Free-text address search. Returns [] rather than throwing on no match. */
  geocode(query: string, near?: LatLng): Promise<GeocodeResult[]>;
  reverseGeocode(point: LatLng): Promise<GeocodeResult | null>;
}

/** Rough bounding box for Ghana, used to bias search and reject bad pins. */
export const GHANA_BOUNDS = {
  minLat: 4.5,
  maxLat: 11.2,
  minLng: -3.3,
  maxLng: 1.2,
} as const;

export function isWithinGhana(point: LatLng): boolean {
  return (
    point.lat >= GHANA_BOUNDS.minLat &&
    point.lat <= GHANA_BOUNDS.maxLat &&
    point.lng >= GHANA_BOUNDS.minLng &&
    point.lng <= GHANA_BOUNDS.maxLng
  );
}

/** Accra city centre. Default map view before the user pins anything. */
export const ACCRA_CENTRE: LatLng = { lat: 5.6037, lng: -0.187 };

/**
 * Leaflet tile layer config.
 *
 * Lives in this module rather than in `osm.ts` because `osm.ts` imports
 * `server-only` — it holds the Nominatim client, which may never run in a
 * browser. The tile URL, by contrast, is only useful in a browser. Re-exported
 * from `osm.ts` so the import site reads naturally either way.
 */
export const OSM_TILE_LAYER = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
} as const;

/**
 * GhanaPostGPS digital address, e.g. GA-543-0125.
 * Region letter + district letter, then 3-4 digits, then 4 digits.
 */
const GHANAPOST_PATTERN = /^[A-Z]{2}-\d{3,4}-\d{4}$/;

export function isValidGhanaPostCode(code: string): boolean {
  return GHANAPOST_PATTERN.test(code.trim().toUpperCase());
}

export function normaliseGhanaPostCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Straight-line distance in km. For display and rough client-side estimates
 * only — anything that decides money or matching uses PostGIS server-side.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return Number((2 * R * Math.asin(Math.sqrt(h))).toFixed(2));
}
