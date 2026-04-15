import { shallowRef } from "vue";

export type LatLngTuple = [number, number];

export const MAP_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
export const MAP_TILE_ATTRIBUTION = "Tiles &copy; <a href='https://www.esri.com/'>Esri</a>";

type LeafletIconFactory = (options: {
  iconUrl: string;
  iconRetinaUrl?: string;
  shadowUrl?: string;
  iconSize?: [number, number];
  iconAnchor?: [number, number];
  popupAnchor?: [number, number];
  shadowSize?: [number, number];
}) => any;

const leafletIconFactory = shallowRef<LeafletIconFactory | null>(null);

if (import.meta.client) {
  import("leaflet")
    .then((L) => {
      leafletIconFactory.value = L.icon;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
    })
    .catch(() => {
      leafletIconFactory.value = null;
    });
}

export function parseCoordinate(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function hasValidCoordinates(lat: unknown, long: unknown) {
  const parsedLat = parseCoordinate(lat);
  const parsedLong = parseCoordinate(long);
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLong) && !(parsedLat === 0 && parsedLong === 0);
}

export function calculateBounds(points: LatLngTuple[]): [LatLngTuple, LatLngTuple] | null {
  if (points.length === 0) {
    return null;
  }

  const [firstLat, firstLong] = points[0]!;
  let minLat = firstLat;
  let maxLat = firstLat;
  let minLong = firstLong;
  let maxLong = firstLong;

  for (const [lat, long] of points) {
    if (lat < minLat) {
      minLat = lat;
    }
    if (lat > maxLat) {
      maxLat = lat;
    }
    if (long < minLong) {
      minLong = long;
    }
    if (long > maxLong) {
      maxLong = long;
    }
  }

  return [[minLat, minLong], [maxLat, maxLong]];
}

export function getNumberedVenueIcon(index: number) {
  if (!leafletIconFactory.value) {
    return undefined;
  }

  const number = index + 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42"><path d="M15 1C8 1 2 7 2 14c0 9.5 10.2 24.4 12.1 27.1.4.6 1.3.6 1.7 0C17.8 38.4 28 23.5 28 14 28 7 22 1 15 1z" fill="#4f46e5" stroke="#ffffff" stroke-width="2"/><circle cx="15" cy="14" r="8" fill="#ffffff"/><text x="15" y="18" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="10" font-weight="700" fill="#312e81">${number}</text></svg>`;

  return leafletIconFactory.value({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    iconRetinaUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [30, 42],
    iconAnchor: [15, 41],
    popupAnchor: [0, -34],
    shadowSize: [41, 41],
  });
}

export function getNumberedVenueMarkerOptions(index: number, venueName: string) {
  const title = `${index + 1}. ${venueName}`;
  const icon = getNumberedVenueIcon(index);

  if (!icon) {
    return { title };
  }

  return {
    title,
    icon,
  };
}

const STATUS_PIN_COLORS: Record<string, { fill: string; stroke: string }> = {
  active: { fill: "#22c55e", stroke: "#ffffff" },
  future: { fill: "#3b82f6", stroke: "#ffffff" },
  past: { fill: "#9ca3af", stroke: "#ffffff" },
};

export function getTournamentStatusIcon(status?: string | null, isActive?: boolean) {
  if (!leafletIconFactory.value)
    return undefined;

  const key = (isActive || status === "active") ? "active" : status === "future" ? "future" : "past";
  const { fill, stroke } = STATUS_PIN_COLORS[key]!;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="38" viewBox="0 0 26 38"><path d="M13 1C7 1 2 6 2 12c0 8.5 9 21.5 10.6 23.8.3.5 1.1.5 1.4 0C15.6 33.5 24 20.5 24 12 24 6 19 1 13 1z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><circle cx="13" cy="12" r="4" fill="white"/></svg>`;

  return leafletIconFactory.value({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    iconRetinaUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [26, 38],
    iconAnchor: [13, 37],
    popupAnchor: [0, -32],
    shadowSize: [41, 41],
  });
}
