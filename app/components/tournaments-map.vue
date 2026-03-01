<script setup lang="ts">
import { LMap, LMarker, LPopup, LTileLayer } from "@vue-leaflet/vue-leaflet";
import "leaflet/dist/leaflet.css";

import { getCountryCoordinates } from "~/utils/country-coordinates";

const props = defineProps<{
  center: [number, number];
  userCountry?: string | null; // ISO country code from user profile
  tournaments: Array<{
    id: number;
    slug: string;
    name: string;
    lat: number;
    long: number;
    city?: string | null;
    country?: string | null;
    startDate?: number | null;
    isActive?: boolean;
    status?: string;
  }>;
}>();

// User location state - initialize from parent-provided center
const mapCenter = ref<[number, number]>(props.center);
const mapZoom = ref(2); // Zoomed out to show global view
const mapViewKey = computed(() => `${mapCenter.value[0]}:${mapCenter.value[1]}:${mapZoom.value}`);
const normalizedUserCountry = computed(() => props.userCountry?.trim() || null);
const mappableTournaments = computed(() =>
  props.tournaments.filter(tournament =>
    Number.isFinite(tournament.lat) && Number.isFinite(tournament.long) && !(tournament.lat === 0 && tournament.long === 0),
  ),
);
const mapBounds = computed<[[number, number], [number, number]] | null>(() => {
  if (mappableTournaments.value.length === 0) {
    return null;
  }

  const [first] = mappableTournaments.value;
  if (!first) {
    return null;
  }

  let minLat = first.lat;
  let maxLat = first.lat;
  let minLong = first.long;
  let maxLong = first.long;

  for (const tournament of mappableTournaments.value) {
    if (tournament.lat < minLat) {
      minLat = tournament.lat;
    }
    if (tournament.lat > maxLat) {
      maxLat = tournament.lat;
    }
    if (tournament.long < minLong) {
      minLong = tournament.long;
    }
    if (tournament.long > maxLong) {
      maxLong = tournament.long;
    }
  }

  return [[minLat, minLong], [maxLat, maxLong]];
});

// Calculate distance between two coordinates in kilometers (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a
    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
      * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check if there are tournaments within a certain radius (500km)
function hasNearbyTournaments(userLat: number, userLon: number, radius = 500): boolean {
  return props.tournaments.some(tournament =>
    calculateDistance(userLat, userLon, tournament.lat, tournament.long) <= radius,
  );
}

// Fix Leaflet default icon paths
if (typeof window !== "undefined") {
  const L = await import("leaflet");
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

watch(
  () => [normalizedUserCountry.value, props.center[0], props.center[1], props.tournaments.length],
  () => {
    // Default view from parent center
    mapCenter.value = props.center;
    mapZoom.value = 2;

    // Country-based zoom for signed-in users
    if (!normalizedUserCountry.value) {
      return;
    }

    const coords = getCountryCoordinates(normalizedUserCountry.value);
    if (!coords) {
      return;
    }

    if (hasNearbyTournaments(coords[0], coords[1])) {
      mapCenter.value = coords;
      mapZoom.value = 6;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="card bg-base-200">
    <div class="card-body p-0">
      <LMap
        :key="mapViewKey"
        :zoom="mapZoom"
        :center="mapCenter"
        :bounds="mapBounds || undefined"
        :bounds-options="{ padding: [28, 28] }"
        style="height: 500px; z-index: 0;"
      >
        <LTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
        />
        <LMarker
          v-for="tournament in tournaments"
          :key="tournament.id"
          :lat-lng="[tournament.lat, tournament.long]"
          :options="{ title: tournament.name }"
        >
          <LPopup>
            <MapLocationPopup
              :title="tournament.name"
              :title-to="`/tournaments/${tournament.slug}`"
              :subtitle="[tournament.city, tournament.country].filter(Boolean).join(', ')"
              :description="tournament.startDate ? new Date(tournament.startDate).toLocaleDateString() : 'TBD'"
              :centered="false"
            >
              <span
                v-if="tournament.isActive"
                class="badge badge-success badge-xs mt-2"
              >
                Live Now
              </span>
              <span
                v-else-if="tournament.status === 'future'"
                class="badge badge-info badge-xs mt-2"
              >
                Upcoming
              </span>
            </MapLocationPopup>
          </LPopup>
        </LMarker>
      </LMap>
    </div>
  </div>
</template>
