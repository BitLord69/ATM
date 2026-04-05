<script setup lang="ts">
import { LMap, LMarker, LPopup, LTileLayer } from "@vue-leaflet/vue-leaflet";
import { computed } from "vue";
import "leaflet/dist/leaflet.css";

const props = defineProps<{
  lat: number;
  long: number;
  name: string;
  city?: string | null;
  country?: string | null;
  venues?: Array<{
    id: number;
    lat: number;
    long: number;
    name: string;
    description: string | null;
    facilities: string | null;
  }>;
}>();

const mappableVenues = computed(() => {
  return (props.venues || [])
    .map((venue, index) => {
      const lat = Number(venue.lat);
      const long = Number(venue.long);
      return {
        venue,
        index,
        lat,
        long,
      };
    })
    .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.long) && !(item.lat === 0 && item.long === 0));
});

const mapBounds = computed<[[number, number], [number, number]]>(() => {
  const points: Array<[number, number]> = [[props.lat, props.long], ...mappableVenues.value.map(item => [item.lat, item.long] as [number, number])];

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
});

let createIcon: ((options: any) => any) | null = null;

function getVenueNumberedIcon(index: number) {
  if (!createIcon) {
    return undefined;
  }

  const number = index + 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42"><path d="M15 1C8 1 2 7 2 14c0 9.5 10.2 24.4 12.1 27.1.4.6 1.3.6 1.7 0C17.8 38.4 28 23.5 28 14 28 7 22 1 15 1z" fill="#4f46e5" stroke="#ffffff" stroke-width="2"/><circle cx="15" cy="14" r="8" fill="#ffffff"/><text x="15" y="18" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="10" font-weight="700" fill="#312e81">${number}</text></svg>`;

  return createIcon({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    iconRetinaUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [30, 42],
    iconAnchor: [15, 41],
    popupAnchor: [0, -34],
    shadowSize: [41, 41],
  });
}

function getVenueMarkerOptions(index: number, venueName: string) {
  const title = `${index + 1}. ${venueName}`;
  const icon = getVenueNumberedIcon(index);

  if (!icon) {
    return { title };
  }

  return {
    title,
    icon,
  };
}

// Fix Leaflet default icon paths
if (typeof window !== "undefined") {
  const L = await import("leaflet");
  createIcon = L.icon;
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}
</script>

<template>
  <div class="card bg-base-200">
    <div class="card-body p-0">
      <LMap
        :zoom="12"
        :center="[lat, long]"
        :bounds="mapBounds"
        :bounds-options="{ padding: [28, 28], maxZoom: 13 }"
        style="height: 400px; z-index: 0;"
      >
        <LTileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          :options="{ referrerPolicy: 'origin' }"
          attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
        />
        <!-- Tournament HQ Marker -->
        <LMarker
          :lat-lng="[lat, long]"
          :options="{ title: `${name} HQ` }"
        >
          <LPopup>
            <MapLocationPopup
              :title="`📍 ${name} HQ`"
              :subtitle="[city, country].filter(Boolean).join(', ')"
            />
          </LPopup>
        </LMarker>
        <!-- Discipline Venue Markers -->
        <LMarker
          v-for="item in mappableVenues"
          :key="item.venue.id"
          :lat-lng="[item.lat, item.long]"
          :options="getVenueMarkerOptions(item.index, item.venue.name)"
        >
          <LPopup>
            <MapLocationPopup
              :title="`${item.index + 1}. ${item.venue.name}`"
              :description="item.venue.description"
              :facilities="item.venue.facilities"
            />
          </LPopup>
        </LMarker>
      </LMap>
    </div>
  </div>
</template>
