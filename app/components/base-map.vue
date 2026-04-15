<script setup lang="ts">
import { LMap, LTileLayer } from "@vue-leaflet/vue-leaflet";
import { nextTick, ref, toRefs, watch } from "vue";

import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "~/composables/use-leaflet-map";

import "leaflet/dist/leaflet.css";

const props = withDefaults(defineProps<{
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

const { center, zoom, height, bounds, boundsOptions, mapKey, withCard } = toRefs(props);

const leafletMap = ref<any | null>(null);

function onMapClick(event: any) {
  emit("mapClick", event);
}

function fitToBounds() {
  if (!leafletMap.value || !bounds.value) {
    return;
  }

  leafletMap.value.invalidateSize();
  leafletMap.value.fitBounds(bounds.value, boundsOptions.value || undefined);
}

function onMapReady(map: any) {
  leafletMap.value = map;
  void nextTick(fitToBounds);
}

watch(
  [bounds, boundsOptions],
  () => {
    void nextTick(fitToBounds);
  },
  { deep: true, immediate: true },
);
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
        @ready="onMapReady"
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
    @ready="onMapReady"
    @click="onMapClick"
  >
    <LTileLayer
      :url="MAP_TILE_URL"
      :attribution="MAP_TILE_ATTRIBUTION"
    />
    <slot />
  </LMap>
</template>
