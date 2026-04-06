<script setup lang="ts">
import { LMarker, LPopup } from "@vue-leaflet/vue-leaflet";

import { calculateBounds, hasValidCoordinates, parseCoordinate } from "~/composables/use-leaflet-map";
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
    hasGolf?: boolean;
    hasAccuracy?: boolean;
    hasDistance?: boolean;
    hasSCF?: boolean;
    hasDiscathon?: boolean;
    hasDDC?: boolean;
    hasFreestyle?: boolean;
  }>;
}>();

// User location state - initialize from parent-provided center
const mapCenter = ref<[number, number]>(props.center);
const mapZoom = ref(2); // Zoomed out to show global view
const mapViewKey = computed(() => `${mapCenter.value[0]}:${mapCenter.value[1]}:${mapZoom.value}`);
const normalizedUserCountry = computed(() => props.userCountry?.trim() || null);
const mappableTournaments = computed(() => {
  return props.tournaments
    .map((tournament) => {
      const lat = parseCoordinate(tournament.lat);
      const long = parseCoordinate(tournament.long);

      return {
        tournament,
        lat,
        long,
      };
    })
    .filter(item => hasValidCoordinates(item.lat, item.long));
});

const mappableTournamentData = computed(() => mappableTournaments.value.map(item => item.tournament));
const mapBounds = computed<[[number, number], [number, number]] | null>(() => {
  return calculateBounds(mappableTournaments.value.map(item => [item.lat, item.long]));
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
  return mappableTournaments.value.some(item =>
    calculateDistance(userLat, userLon, item.lat, item.long) <= radius,
  );
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
  <BaseMap
    :map-key="mapViewKey"
    :zoom="mapZoom"
    :center="mapCenter"
    :bounds="mapBounds || undefined"
    :bounds-options="{ padding: [28, 28] }"
    height="500px"
  >
    <LMarker
      v-for="tournament in mappableTournamentData"
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
          :has-golf="tournament.hasGolf"
          :has-accuracy="tournament.hasAccuracy"
          :has-distance="tournament.hasDistance"
          :has-scf="tournament.hasSCF"
          :has-discathon="tournament.hasDiscathon"
          :has-ddc="tournament.hasDDC"
          :has-freestyle="tournament.hasFreestyle"
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
  </BaseMap>
</template>
