<script setup lang="ts">
import { LMarker, LPopup } from "@vue-leaflet/vue-leaflet";
import { computed } from "vue";

import {
  calculateBounds,
  getNumberedVenueMarkerOptions,
  hasValidCoordinates,
  parseCoordinate,
} from "~/composables/use-leaflet-map";

const props = withDefaults(defineProps<{
  lat: number;
  long: number;
  name: string;
  city?: string | null;
  country?: string | null;
  height?: string;
  venues?: Array<{
    id: number;
    lat: number;
    long: number;
    name: string;
    description: string | null;
    facilities: string | null;
    hasGolf?: boolean;
    hasAccuracy?: boolean;
    hasDistance?: boolean;
    hasSCF?: boolean;
    hasDiscathon?: boolean;
    hasDDC?: boolean;
    hasFreestyle?: boolean;
  }>;
}>(), {
  height: "400px",
  venues: () => [],
});

const emit = defineEmits<{
  (event: "mapClick", value: any): void;
}>();

const mappableVenues = computed(() => {
  return (props.venues || [])
    .map((venue, index) => {
      const lat = parseCoordinate(venue.lat);
      const long = parseCoordinate(venue.long);
      return {
        venue,
        index,
        lat,
        long,
      };
    })
    .filter(item => hasValidCoordinates(item.lat, item.long));
});

const mapBounds = computed<[[number, number], [number, number]] | null>(() => {
  const points: Array<[number, number]> = [[props.lat, props.long], ...mappableVenues.value.map(item => [item.lat, item.long] as [number, number])];

  return calculateBounds(points);
});
</script>

<template>
  <BaseMap
    :zoom="12"
    :center="[lat, long]"
    :bounds="mapBounds || undefined"
    :bounds-options="{ padding: [28, 28], maxZoom: 13 }"
    :height="height"
    @map-click="emit('mapClick', $event)"
  >
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
      :options="getNumberedVenueMarkerOptions(item.index, item.venue.name)"
    >
      <LPopup>
        <MapLocationPopup
          :title="`${item.index + 1}. ${item.venue.name}`"
          :description="item.venue.description"
          :facilities="item.venue.facilities"
          :has-golf="item.venue.hasGolf"
          :has-accuracy="item.venue.hasAccuracy"
          :has-distance="item.venue.hasDistance"
          :has-scf="item.venue.hasSCF"
          :has-discathon="item.venue.hasDiscathon"
          :has-ddc="item.venue.hasDDC"
          :has-freestyle="item.venue.hasFreestyle"
        />
      </LPopup>
    </LMarker>
  </BaseMap>
</template>
