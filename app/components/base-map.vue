<script setup lang="ts">
import { LMap, LTileLayer } from "@vue-leaflet/vue-leaflet";

import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "~/composables/use-leaflet-map";

import "leaflet/dist/leaflet.css";

withDefaults(defineProps<{
  center: [number, number];
  zoom: number;
  height?: string;
  bounds?: [[number, number], [number, number]];
  boundsOptions?: Record<string, any>;
  mapKey?: string | number;
  withCard?: boolean;
}>(), {
  height: "400px",
  bounds: undefined,
  boundsOptions: undefined,
  mapKey: undefined,
  withCard: true,
});

const emit = defineEmits<{
  (event: "mapClick", value: any): void;
}>();

function onMapClick(event: any) {
  emit("mapClick", event);
}
</script>

<template>
  <div v-if="withCard" class="card bg-base-200">
    <div class="card-body p-0">
      <LMap
        :key="mapKey"
        :zoom="zoom"
        :center="center"
        :bounds="bounds"
        :bounds-options="boundsOptions"
        :style="{ height, zIndex: 0 }"
        @click="onMapClick"
      >
        <LTileLayer
          :url="MAP_TILE_URL"
          :attribution="MAP_TILE_ATTRIBUTION"
        />
        <slot />
      </LMap>
    </div>
  </div>

  <LMap
    v-else
    :key="mapKey"
    :zoom="zoom"
    :center="center"
    :bounds="bounds"
    :bounds-options="boundsOptions"
    :style="{ height, zIndex: 0 }"
    @click="onMapClick"
  >
    <LTileLayer
      :url="MAP_TILE_URL"
      :attribution="MAP_TILE_ATTRIBUTION"
    />
    <slot />
  </LMap>
</template>
