export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function kmToMiles(km: number): number {
  return km * 0.621371;
}

export function milesToKm(mi: number): number {
  return mi / 0.621371;
}

/**
 * Looks up coordinates for a city/country pair via OpenStreetMap Nominatim.
 * Returns null gracefully on network errors, timeouts, or when no match is found.
 */
export async function geocodeCityCountry(
  city?: string | null,
  country?: string | null,
): Promise<{ lat: number; long: number } | null> {
  const query = [city?.trim(), country?.trim()].filter(Boolean).join(", ");
  if (!query) {
    return null;
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          "User-Agent": "ATM-Allround-Tournament-Manager/1.0",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      const results = await response.json() as Array<{ lat?: string; lon?: string }>;
      const first = results[0];
      if (!first?.lat || !first?.lon) {
        return null;
      }

      const lat = Number.parseFloat(first.lat);
      const long = Number.parseFloat(first.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(long)) {
        return null;
      }

      return { lat, long };
    }
    finally {
      clearTimeout(timeout);
    }
  }
  catch {
    return null;
  }
}
