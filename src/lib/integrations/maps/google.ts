import "server-only";

import { env } from "@/lib/env";
import type { GeocodeResult, LatLng, MapProvider } from "./types";

/**
 * Google Maps geocoding.
 *
 * NOT YET EXERCISED — enabled at go-live once the client's business has a
 * billing account. Set a hard spend cap on the Google Cloud project and
 * restrict the key by HTTP referrer BEFORE the app goes public; an unrestricted
 * Maps key is one of the easiest ways to get a surprise four-figure bill.
 */

const GEOCODE_API = "https://maps.googleapis.com/maps/api/geocode/json";

interface GoogleGeocodeResponse {
  status: string;
  results: {
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    address_components: { long_name: string; types: string[] }[];
  }[];
}

function cityFrom(components: GoogleGeocodeResponse["results"][number]["address_components"]) {
  const match = components.find(
    (c) => c.types.includes("locality") || c.types.includes("administrative_area_level_2"),
  );
  return match?.long_name;
}

export class GoogleMapProvider implements MapProvider {
  readonly name = "google";

  private async call(params: Record<string, string>): Promise<GoogleGeocodeResponse | null> {
    const url = new URL(GEOCODE_API);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("key", env.GOOGLE_MAPS_API_KEY!);
    url.searchParams.set("region", "gh");

    try {
      const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
      if (!response.ok) return null;
      return (await response.json()) as GoogleGeocodeResponse;
    } catch (error) {
      console.error("[maps:google] request failed", error);
      return null;
    }
  }

  async geocode(query: string): Promise<GeocodeResult[]> {
    const payload = await this.call({ address: query, components: "country:GH" });
    if (!payload || payload.status !== "OK") return [];

    return payload.results.map((result) => ({
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      label: result.formatted_address,
      city: cityFrom(result.address_components),
    }));
  }

  async reverseGeocode(point: LatLng): Promise<GeocodeResult | null> {
    const payload = await this.call({ latlng: `${point.lat},${point.lng}` });
    if (!payload || payload.status !== "OK" || payload.results.length === 0) return null;

    const [result] = payload.results;
    return {
      lat: point.lat,
      lng: point.lng,
      label: result.formatted_address,
      city: cityFrom(result.address_components),
    };
  }
}
