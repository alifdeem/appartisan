"use server";

import { getMapProvider, isWithinGhana, type GeocodeResult } from "@/lib/integrations/maps";
import { createClient } from "@/lib/supabase/server";

/**
 * Address lookup for the location picker.
 *
 * This has to be a Server Action rather than a `fetch` from the map component:
 * Nominatim's usage policy requires an identifying User-Agent and caps calls at
 * roughly one per second, neither of which survives contact with a browser. The
 * adapter also caches for a day, which only works server-side.
 *
 * Kept in its own module because `actions.ts` is mutations — these two are
 * reads, and mixing them makes it harder to see at a glance which entry points
 * can change data.
 */

/** A Server Action is a public endpoint. Geocoding is cheap, but not free. */
async function requireSession(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function searchAddressAction(query: string): Promise<GeocodeResult[]> {
  if (!(await requireSession())) return [];

  const trimmed = query.trim();
  // Two characters matches half of Accra and costs a request to find that out.
  if (trimmed.length < 3) return [];

  const results = await getMapProvider().geocode(trimmed);

  // The provider is already biased to Ghana, but bias is not a guarantee and a
  // result in the Gulf of Guinea would drop a pin the RPC then rejects.
  return results.filter(isWithinGhana).slice(0, 6);
}

export async function reverseGeocodeAction(
  lat: number,
  lng: number,
): Promise<{ label: string; city?: string } | null> {
  if (!(await requireSession())) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!isWithinGhana({ lat, lng })) return null;

  const result = await getMapProvider().reverseGeocode({ lat, lng });
  if (!result) return null;

  return { label: result.label, city: result.city };
}
