<script setup lang="ts">
import { LMarker, LPopup } from "@vue-leaflet/vue-leaflet";

import {
  getNumberedVenueMarkerOptions,
  hasValidCoordinates,
  parseCoordinate,
} from "~/composables/use-leaflet-map";

const props = withDefaults(defineProps<{
  lat: number | string | null | undefined;
  long: number | string | null | undefined;
  title?: string;
  description?: string | null;
  facilities?: string | null;
  hasGolf?: boolean;
  hasAccuracy?: boolean;
  hasDistance?: boolean;
  hasSCF?: boolean;
  hasDiscathon?: boolean;
  hasDDC?: boolean;
  hasFreestyle?: boolean;
  fallbackCenter?: [number, number];
  height?: string;
  setZoom?: number;
  unsetZoom?: number;
  clickable?: boolean;
  numberedMarker?: boolean;
  markerIndex?: number;
}>(), {
  title: "Venue",
  description: null,
  facilities: null,
  hasGolf: false,
  hasAccuracy: false,
  hasDistance: false,
  hasSCF: false,
  hasDiscathon: false,
  hasDDC: false,
  hasFreestyle: false,
  fallbackCenter: () => [59.67497, 12.85981],
  height: "220px",
  setZoom: 12,
  unsetZoom: 5,
  clickable: false,
  numberedMarker: false,
  markerIndex: 0,
});

const emit = defineEmits<{
  (event: "mapClick", value: any): void;
}>();

const parsedLat = computed(() => parseCoordinate(props.lat));
const parsedLong = computed(() => parseCoordinate(props.long));
const hasCoordinates = computed(() => hasValidCoordinates(parsedLat.value, parsedLong.value));

const center = computed<[number, number]>(() => {
  if (hasCoordinates.value) {
    return [parsedLat.value, parsedLong.value];
  }

  return props.fallbackCenter;
});

const markerLatLng = computed<[number, number] | null>(() => {
  if (!hasCoordinates.value) {
    return null;
  }

  return [parsedLat.value, parsedLong.value];
});

const markerOptions = computed(() => {
  if (props.numberedMarker) {
    return getNumberedVenueMarkerOptions(props.markerIndex, props.title || "Venue");
  }

  return { title: props.title || "Venue" };
});

function onMapClick(event: any) {
  if (!props.clickable) {
    return;
  }

  emit("mapClick", event);
}
</script>

<template>
  <BaseMap
    :zoom="hasCoordinates ? setZoom : unsetZoom"
    :center="center"
    :height="height"
    :with-card="false"
    @map-click="onMapClick"
  >
    <LMarker
      v-if="markerLatLng"
      :lat-lng="markerLatLng"
      :options="markerOptions"
    >
      <LPopup>
        <MapLocationPopup
          :title="title || 'Venue'"
          :description="description"
          :facilities="facilities"
          :has-golf="hasGolf"
          :has-accuracy="hasAccuracy"
          :has-distance="hasDistance"
          :has-scf="hasSCF"
          :has-discathon="hasDiscathon"
          :has-ddc="hasDDC"
          :has-freestyle="hasFreestyle"
          :centered="false"
        />
      </LPopup>
    </LMarker>
  </BaseMap>
</template>
