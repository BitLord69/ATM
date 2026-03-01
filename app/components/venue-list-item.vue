<script setup lang="ts">
import { computed } from "vue";

type VenueSummary = {
  name: string;
  description?: string | null;
  facilities?: string | null;
  lat: number;
  long: number;
};

const props = withDefaults(defineProps<{
  venue: VenueSummary;
  title?: string;
  titleClass?: string;
  showCoordinates?: boolean;
  coordinatesClass?: string;
}>(), {
  title: "",
  titleClass: "font-medium",
  showCoordinates: true,
  coordinatesClass: "text-sm opacity-70",
});

const displayTitle = computed(() => props.title || props.venue.name);

const hasValidCoordinates = computed(() => Number.isFinite(props.venue.lat) && Number.isFinite(props.venue.long));

const coordinatesText = computed(() => {
  if (!hasValidCoordinates.value) {
    return null;
  }

  return `${props.venue.lat.toFixed(6)}, ${props.venue.long.toFixed(6)}`;
});
</script>

<template>
  <div class="space-y-2">
    <p :class="titleClass">
      {{ displayTitle }}
    </p>
    <p
      v-if="venue.description"
      class="text-sm opacity-80"
    >
      {{ venue.description }}
    </p>
    <p
      v-if="venue.facilities"
      class="text-sm opacity-80"
    >
      Facilities: {{ venue.facilities }}
    </p>
    <p
      v-if="showCoordinates && coordinatesText"
      :class="coordinatesClass"
    >
      Coordinates: {{ coordinatesText }}
    </p>
    <slot />
  </div>
</template>
